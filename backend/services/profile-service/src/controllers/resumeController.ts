import { Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@jobgraph/common';
import { parseResume } from '../services/resumeParser';

/**
 * Upload resume
 * POST /api/v1/profiles/candidate/resume/upload
 */
export async function uploadResume(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json(errorResponse(
        'MISSING_FILE',
        'No file uploaded'
      ));
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'text/plain'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json(errorResponse(
        'INVALID_FILE_TYPE',
        'Only PDF, DOCX, and TXT files are allowed'
      ));
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return res.status(400).json(errorResponse(
        'FILE_TOO_LARGE',
        'File size must be less than 10MB'
      ));
    }

    // Delete any existing resumes (Phase 1: no versioning, replace on upload)
    // Note: CASCADE will also delete related parsed_data, suggestions, and shares
    await query(
      `DELETE FROM user_documents
       WHERE user_id = $1 AND document_type = 'resume'`,
      [userId]
    );

    // Store file in database
    const result = await query(
      `INSERT INTO user_documents (
        user_id, document_type, file_name, file_size, mime_type,
        file_data, is_current, version, upload_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING document_id, file_name, file_size, uploaded_at, upload_status`,
      [
        userId,
        'resume',
        file.originalname,
        file.size,
        file.mimetype,
        file.buffer, // Store binary data
        true, // is_current
        1, // Always version 1 (no versioning in Phase 1)
        'pending'
      ]
    );

    const document = result.rows[0];

    // Trigger parsing asynchronously (don't await)
    parseResume(document.document_id).catch(error => {
      console.error('[ResumeController] Parsing error:', error);
    });

    res.status(201).json(successResponse({
      documentId: document.document_id,
      fileName: document.file_name,
      fileSize: document.file_size,
      uploadedAt: document.uploaded_at,
      uploadStatus: document.upload_status,
      message: 'Resume uploaded successfully. Parsing in progress.'
    }));

  } catch (error: any) {
    console.error('[ResumeController] Upload error:', error);
    res.status(500).json(errorResponse(
      'UPLOAD_FAILED',
      'Failed to upload resume',
      { error: error.message }
    ));
  }
}

/**
 * Get current resume metadata
 * GET /api/v1/profiles/candidate/resume
 */
export async function getCurrentResume(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;

    const result = await query(
      `SELECT
        d.document_id,
        d.file_name,
        d.file_size,
        d.mime_type,
        d.uploaded_at,
        d.processed_at,
        d.upload_status,
        d.processing_error,
        d.version,
        CASE WHEN p.parsed_data_id IS NOT NULL THEN true ELSE false END as has_parsed_data
      FROM user_documents d
      LEFT JOIN resume_parsed_data p ON d.document_id = p.document_id
      WHERE d.user_id = $1
        AND d.document_type = 'resume'
        AND d.is_current = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse(
        'RESUME_NOT_FOUND',
        'No resume found for this user'
      ));
    }

    const resume = result.rows[0];

    res.json(successResponse({
      documentId: resume.document_id,
      fileName: resume.file_name,
      fileSize: resume.file_size,
      mimeType: resume.mime_type,
      uploadedAt: resume.uploaded_at,
      processedAt: resume.processed_at,
      uploadStatus: resume.upload_status,
      processingError: resume.processing_error,
      version: resume.version,
      hasParsedData: resume.has_parsed_data
    }));

  } catch (error: any) {
    console.error('[ResumeController] Get resume error:', error);
    res.status(500).json(errorResponse(
      'GET_RESUME_FAILED',
      'Failed to retrieve resume',
      { error: error.message }
    ));
  }
}

/**
 * Download resume file
 * GET /api/v1/profiles/candidate/resume/download
 */
export async function downloadResume(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;

    const result = await query(
      `SELECT document_id, file_name, mime_type, file_data
       FROM user_documents
       WHERE user_id = $1
         AND document_type = 'resume'
         AND is_current = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse(
        'RESUME_NOT_FOUND',
        'No resume found for this user'
      ));
    }

    const resume = result.rows[0];

    // Set headers for file download
    res.setHeader('Content-Type', resume.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${resume.file_name}"`);
    res.setHeader('Content-Length', resume.file_data.length);

    // Send binary data
    res.send(resume.file_data);

  } catch (error: any) {
    console.error('[ResumeController] Download error:', error);
    res.status(500).json(errorResponse(
      'DOWNLOAD_FAILED',
      'Failed to download resume',
      { error: error.message }
    ));
  }
}

/**
 * Delete resume
 * DELETE /api/v1/profiles/candidate/resume/:documentId
 */
export async function deleteResume(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;
    const { documentId } = req.params;

    // Verify ownership
    const checkResult = await query(
      `SELECT document_id FROM user_documents
       WHERE document_id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json(errorResponse(
        'RESUME_NOT_FOUND',
        'Resume not found or you do not have permission to delete it'
      ));
    }

    // Delete document (cascades to parsed_data and suggestions)
    await query(
      `DELETE FROM user_documents WHERE document_id = $1`,
      [documentId]
    );

    res.json(successResponse({
      message: 'Resume deleted successfully'
    }));

  } catch (error: any) {
    console.error('[ResumeController] Delete error:', error);
    res.status(500).json(errorResponse(
      'DELETE_FAILED',
      'Failed to delete resume',
      { error: error.message }
    ));
  }
}

/**
 * Get parsed resume data
 * GET /api/v1/profiles/candidate/resume/parsed
 */
export async function getParsedData(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;

    const result = await query(
      `SELECT
        p.parsed_data_id,
        p.contact_info,
        p.summary,
        p.skills,
        p.education,
        p.work_experience,
        p.certifications,
        p.parser_used,
        p.confidence_score,
        p.created_at,
        d.file_name
      FROM resume_parsed_data p
      JOIN user_documents d ON p.document_id = d.document_id
      WHERE p.user_id = $1
        AND d.is_current = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse(
        'PARSED_DATA_NOT_FOUND',
        'No parsed resume data found'
      ));
    }

    const parsed = result.rows[0];

    res.json(successResponse({
      parsedDataId: parsed.parsed_data_id,
      fileName: parsed.file_name,
      contactInfo: parsed.contact_info,
      summary: parsed.summary,
      skills: parsed.skills,
      education: parsed.education,
      workExperience: parsed.work_experience,
      certifications: parsed.certifications,
      parserUsed: parsed.parser_used,
      confidenceScore: parsed.confidence_score,
      createdAt: parsed.created_at
    }));

  } catch (error: any) {
    console.error('[ResumeController] Get parsed data error:', error);
    res.status(500).json(errorResponse(
      'GET_PARSED_DATA_FAILED',
      'Failed to retrieve parsed data',
      { error: error.message }
    ));
  }
}

/**
 * Get auto-fill suggestions
 * GET /api/v1/profiles/candidate/resume/suggestions
 */
export async function getSuggestions(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;

    const result = await query(
      `SELECT
        suggestion_id,
        suggestion_type,
        suggested_data,
        target_table,
        confidence,
        status,
        created_at
      FROM resume_autofill_suggestions
      WHERE user_id = $1
        AND status = 'pending'
      ORDER BY suggestion_type, created_at`,
      [userId]
    );

    // Group suggestions by type
    const groupedSuggestions = {
      basic_info: [] as any[],
      education: [] as any[],
      work_experience: [] as any[],
      skills: [] as any[]
    };

    for (const row of result.rows) {
      const suggestion = {
        suggestionId: row.suggestion_id,
        suggestedData: row.suggested_data,
        targetTable: row.target_table,
        confidence: row.confidence,
        status: row.status,
        createdAt: row.created_at
      };

      groupedSuggestions[row.suggestion_type as keyof typeof groupedSuggestions].push(suggestion);
    }

    res.json(successResponse({
      suggestions: groupedSuggestions,
      totalCount: result.rows.length
    }));

  } catch (error: any) {
    console.error('[ResumeController] Get suggestions error:', error);
    res.status(500).json(errorResponse(
      'GET_SUGGESTIONS_FAILED',
      'Failed to retrieve suggestions',
      { error: error.message }
    ));
  }
}

/**
 * Apply a suggestion to profile
 * POST /api/v1/profiles/candidate/resume/suggestions/:suggestionId/apply
 */
export async function applySuggestion(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;
    const { suggestionId } = req.params;

    // Fetch the suggestion
    const suggestionResult = await query(
      `SELECT suggestion_id, user_id, suggestion_type, suggested_data,
              target_table, confidence
       FROM resume_autofill_suggestions
       WHERE suggestion_id = $1 AND user_id = $2 AND status = 'pending'`,
      [suggestionId, userId]
    );

    if (suggestionResult.rows.length === 0) {
      return res.status(404).json(errorResponse(
        'SUGGESTION_NOT_FOUND',
        'Suggestion not found or already applied'
      ));
    }

    const suggestion = suggestionResult.rows[0];

    // Apply the suggestion based on type
    if (suggestion.suggestion_type === 'basic_info') {
      await applyBasicInfoSuggestion(userId, suggestion.suggested_data);
    } else if (suggestion.suggestion_type === 'education') {
      await applyEducationSuggestion(userId, suggestion.suggested_data);
    } else if (suggestion.suggestion_type === 'work_experience') {
      await applyWorkExperienceSuggestion(userId, suggestion.suggested_data);
    } else if (suggestion.suggestion_type === 'skills') {
      await applySkillsSuggestion(userId, suggestion.suggested_data);
    }

    // Mark suggestion as applied
    await query(
      `UPDATE resume_autofill_suggestions
       SET status = 'applied', applied_at = NOW()
       WHERE suggestion_id = $1`,
      [suggestionId]
    );

    res.json(successResponse({
      message: 'Suggestion applied successfully'
    }));

  } catch (error: any) {
    console.error('[ResumeController] Apply suggestion error:', error);
    res.status(500).json(errorResponse(
      'APPLY_SUGGESTION_FAILED',
      'Failed to apply suggestion',
      { error: error.message }
    ));
  }
}

/**
 * Reject a suggestion
 * DELETE /api/v1/profiles/candidate/resume/suggestions/:suggestionId
 */
export async function rejectSuggestion(req: Request, res: Response) {
  try {
    const userId = (req as any).user.user_id;
    const { suggestionId } = req.params;

    // Verify ownership and update status
    const result = await query(
      `UPDATE resume_autofill_suggestions
       SET status = 'rejected', applied_at = NOW()
       WHERE suggestion_id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING suggestion_id`,
      [suggestionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse(
        'SUGGESTION_NOT_FOUND',
        'Suggestion not found or already processed'
      ));
    }

    res.json(successResponse({
      message: 'Suggestion rejected successfully'
    }));

  } catch (error: any) {
    console.error('[ResumeController] Reject suggestion error:', error);
    res.status(500).json(errorResponse(
      'REJECT_SUGGESTION_FAILED',
      'Failed to reject suggestion',
      { error: error.message }
    ));
  }
}

/**
 * Helper: Apply basic info suggestion
 */
async function applyBasicInfoSuggestion(userId: string, suggestedData: any) {
  if (suggestedData.field === 'location') {
    await query(
      `UPDATE candidate_profiles
       SET city = $1, state = $2, country = $3
       WHERE user_id = $4`,
      [suggestedData.city, suggestedData.state, suggestedData.country, userId]
    );
  } else if (suggestedData.field === 'summary') {
    await query(
      `UPDATE candidate_profiles
       SET summary = $1
       WHERE user_id = $2`,
      [suggestedData.value, userId]
    );
  }
}

/**
 * Helper: Apply education suggestion
 */
async function applyEducationSuggestion(userId: string, suggestedData: any) {
  // Get profile_id for this user
  const profileResult = await query(
    `SELECT profile_id FROM candidate_profiles WHERE user_id = $1`,
    [userId]
  );

  if (profileResult.rows.length === 0) {
    throw new Error('Profile not found');
  }

  const profileId = profileResult.rows[0].profile_id;

  await query(
    `INSERT INTO education (
      profile_id, degree, field_of_study, institution, graduation_year, gpa
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      profileId,
      suggestedData.degree,
      suggestedData.field_of_study || null,
      suggestedData.institution,
      suggestedData.graduation_year || null,
      suggestedData.gpa || null
    ]
  );
}

/**
 * Helper: Apply work experience suggestion
 */
async function applyWorkExperienceSuggestion(userId: string, suggestedData: any) {
  // Get profile_id for this user
  const profileResult = await query(
    `SELECT profile_id FROM candidate_profiles WHERE user_id = $1`,
    [userId]
  );

  if (profileResult.rows.length === 0) {
    throw new Error('Profile not found');
  }

  const profileId = profileResult.rows[0].profile_id;

  await query(
    `INSERT INTO work_experience (
      profile_id, title, company, start_date, end_date, is_current, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      profileId,
      suggestedData.title,
      suggestedData.company,
      suggestedData.start_date || null,
      suggestedData.end_date || null,
      suggestedData.is_current || false,
      suggestedData.description || null
    ]
  );
}

/**
 * Helper: Apply skills suggestion
 */
async function applySkillsSuggestion(userId: string, suggestedData: any) {
  // Find skill_id by name
  const skillResult = await query(
    `SELECT skill_id FROM skills WHERE name = $1`,
    [suggestedData.skill_name]
  );

  if (skillResult.rows.length > 0) {
    const skillId = skillResult.rows[0].skill_id;

    // Add to user_skill_scores with a default score of 60 (intermediate)
    await query(
      `INSERT INTO user_skill_scores (
        user_id, skill_id, score, interview_id, expires_at
      ) VALUES ($1, $2, $3, NULL, NOW() + INTERVAL '1 year')
      ON CONFLICT (user_id, skill_id) DO NOTHING`,
      [userId, skillId, 60] // Default score for resume-detected skills
    );
  }
}
