import { Request, Response } from 'express';
import { query } from '@jobgraph/common';
import { successResponse, errorResponse } from '@jobgraph/common';

/**
 * Get candidate profile
 * GET /api/v1/profiles/candidate
 */
export async function getCandidateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;

    // Get profile with education and work experience
    const result = await query(
      `SELECT cp.*,
              (SELECT json_agg(e.* ORDER BY e.graduation_year DESC)
               FROM education e WHERE e.profile_id = cp.profile_id) as education,
              (SELECT json_agg(we.* ORDER BY we.start_date DESC)
               FROM work_experience we WHERE we.profile_id = cp.profile_id) as work_experience
       FROM candidate_profiles cp
       WHERE cp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('PROFILE_NOT_FOUND', 'Profile not found')
      );
      return;
    }

    const profile = result.rows[0];

    res.status(200).json(
      successResponse({
        profileId: profile.profile_id,
        userId: profile.user_id,
        headline: profile.headline,
        summary: profile.summary,
        yearsExperience: profile.years_experience,
        resumeUrl: profile.resume_url,
        resumeParsedData: profile.resume_parsed_data,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        willingToRelocate: profile.willing_to_relocate,
        remotePreference: profile.remote_preference,
        profileVisibility: profile.profile_visibility,
        education: profile.education || [],
        workExperience: profile.work_experience || [],
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      })
    );
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching profile')
    );
  }
}

/**
 * Update candidate profile
 * PUT /api/v1/profiles/candidate
 */
export async function updateCandidateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const {
      headline,
      summary,
      yearsExperience,
      city,
      state,
      country,
      willingToRelocate,
      remotePreference,
      profileVisibility,
    } = req.body;

    // Validate remote preference
    if (remotePreference && !['remote', 'hybrid', 'onsite', 'flexible'].includes(remotePreference)) {
      res.status(400).json(
        errorResponse('INVALID_REMOTE_PREFERENCE', 'Remote preference must be remote, hybrid, onsite, or flexible')
      );
      return;
    }

    // Validate profile visibility
    if (profileVisibility && !['public', 'private', 'anonymous'].includes(profileVisibility)) {
      res.status(400).json(
        errorResponse('INVALID_VISIBILITY', 'Profile visibility must be public, private, or anonymous')
      );
      return;
    }

    const result = await query(
      `UPDATE candidate_profiles
       SET headline = COALESCE($2, headline),
           summary = COALESCE($3, summary),
           years_experience = COALESCE($4, years_experience),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           country = COALESCE($7, country),
           willing_to_relocate = COALESCE($8, willing_to_relocate),
           remote_preference = COALESCE($9, remote_preference),
           profile_visibility = COALESCE($10, profile_visibility),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        headline,
        summary,
        yearsExperience,
        city,
        state,
        country,
        willingToRelocate,
        remotePreference,
        profileVisibility,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('PROFILE_NOT_FOUND', 'Profile not found')
      );
      return;
    }

    const profile = result.rows[0];

    res.status(200).json(
      successResponse({
        profileId: profile.profile_id,
        headline: profile.headline,
        summary: profile.summary,
        yearsExperience: profile.years_experience,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        willingToRelocate: profile.willing_to_relocate,
        remotePreference: profile.remote_preference,
        profileVisibility: profile.profile_visibility,
        updatedAt: profile.updated_at,
      })
    );
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating profile')
    );
  }
}

/**
 * Add education
 * POST /api/v1/profiles/candidate/education
 */
export async function addEducation(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { degree, fieldOfStudy, institution, graduationYear, gpa } = req.body;

    // Validate required fields
    if (!degree || !institution || !graduationYear) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Degree, institution, and graduation year are required')
      );
      return;
    }

    // Get profile_id
    const profileResult = await query(
      'SELECT profile_id FROM candidate_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      res.status(404).json(
        errorResponse('PROFILE_NOT_FOUND', 'Profile not found')
      );
      return;
    }

    const profileId = profileResult.rows[0].profile_id;

    const result = await query(
      `INSERT INTO education (profile_id, degree, field_of_study, institution, graduation_year, gpa)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [profileId, degree, fieldOfStudy, institution, graduationYear, gpa]
    );

    const education = result.rows[0];

    res.status(201).json(
      successResponse({
        educationId: education.education_id,
        degree: education.degree,
        fieldOfStudy: education.field_of_study,
        institution: education.institution,
        graduationYear: education.graduation_year,
        gpa: education.gpa,
        createdAt: education.created_at,
      })
    );
  } catch (error) {
    console.error('Add education error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred adding education')
    );
  }
}

/**
 * Update education
 * PUT /api/v1/profiles/candidate/education/:educationId
 */
export async function updateEducation(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { educationId } = req.params;
    const { degree, fieldOfStudy, institution, graduationYear, gpa } = req.body;

    const result = await query(
      `UPDATE education e
       SET degree = COALESCE($3, e.degree),
           field_of_study = COALESCE($4, e.field_of_study),
           institution = COALESCE($5, e.institution),
           graduation_year = COALESCE($6, e.graduation_year),
           gpa = COALESCE($7, e.gpa)
       FROM candidate_profiles cp
       WHERE e.profile_id = cp.profile_id
       AND cp.user_id = $1
       AND e.education_id = $2
       RETURNING e.*`,
      [userId, educationId, degree, fieldOfStudy, institution, graduationYear, gpa]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('EDUCATION_NOT_FOUND', 'Education record not found')
      );
      return;
    }

    const education = result.rows[0];

    res.status(200).json(
      successResponse({
        educationId: education.education_id,
        degree: education.degree,
        fieldOfStudy: education.field_of_study,
        institution: education.institution,
        graduationYear: education.graduation_year,
        gpa: education.gpa,
        updatedAt: education.updated_at,
      })
    );
  } catch (error) {
    console.error('Update education error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating education')
    );
  }
}

/**
 * Delete education
 * DELETE /api/v1/profiles/candidate/education/:educationId
 */
export async function deleteEducation(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { educationId } = req.params;

    const result = await query(
      `DELETE FROM education e
       USING candidate_profiles cp
       WHERE e.profile_id = cp.profile_id
       AND cp.user_id = $1
       AND e.education_id = $2
       RETURNING e.education_id`,
      [userId, educationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('EDUCATION_NOT_FOUND', 'Education record not found')
      );
      return;
    }

    res.status(200).json(
      successResponse({ message: 'Education deleted successfully' })
    );
  } catch (error) {
    console.error('Delete education error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred deleting education')
    );
  }
}

/**
 * Add work experience
 * POST /api/v1/profiles/candidate/experience
 */
export async function addWorkExperience(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { title, company, startDate, endDate, isCurrent, description } = req.body;

    // Validate required fields
    if (!title || !company || !startDate) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Title, company, and start date are required')
      );
      return;
    }

    // Get profile_id
    const profileResult = await query(
      'SELECT profile_id FROM candidate_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      res.status(404).json(
        errorResponse('PROFILE_NOT_FOUND', 'Profile not found')
      );
      return;
    }

    const profileId = profileResult.rows[0].profile_id;

    const result = await query(
      `INSERT INTO work_experience (profile_id, title, company, start_date, end_date, is_current, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [profileId, title, company, startDate, endDate, isCurrent || false, description]
    );

    const experience = result.rows[0];

    res.status(201).json(
      successResponse({
        experienceId: experience.experience_id,
        title: experience.title,
        company: experience.company,
        startDate: experience.start_date,
        endDate: experience.end_date,
        isCurrent: experience.is_current,
        description: experience.description,
        createdAt: experience.created_at,
      })
    );
  } catch (error) {
    console.error('Add work experience error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred adding work experience')
    );
  }
}

/**
 * Update work experience
 * PUT /api/v1/profiles/candidate/experience/:experienceId
 */
export async function updateWorkExperience(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { experienceId } = req.params;
    const { title, company, startDate, endDate, isCurrent, description } = req.body;

    const result = await query(
      `UPDATE work_experience we
       SET title = COALESCE($3, we.title),
           company = COALESCE($4, we.company),
           start_date = COALESCE($5, we.start_date),
           end_date = COALESCE($6, we.end_date),
           is_current = COALESCE($7, we.is_current),
           description = COALESCE($8, we.description)
       FROM candidate_profiles cp
       WHERE we.profile_id = cp.profile_id
       AND cp.user_id = $1
       AND we.experience_id = $2
       RETURNING we.*`,
      [userId, experienceId, title, company, startDate, endDate, isCurrent, description]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('EXPERIENCE_NOT_FOUND', 'Work experience record not found')
      );
      return;
    }

    const experience = result.rows[0];

    res.status(200).json(
      successResponse({
        experienceId: experience.experience_id,
        title: experience.title,
        company: experience.company,
        startDate: experience.start_date,
        endDate: experience.end_date,
        isCurrent: experience.is_current,
        description: experience.description,
        updatedAt: experience.updated_at,
      })
    );
  } catch (error) {
    console.error('Update work experience error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating work experience')
    );
  }
}

/**
 * Delete work experience
 * DELETE /api/v1/profiles/candidate/experience/:experienceId
 */
export async function deleteWorkExperience(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { experienceId } = req.params;

    const result = await query(
      `DELETE FROM work_experience we
       USING candidate_profiles cp
       WHERE we.profile_id = cp.profile_id
       AND cp.user_id = $1
       AND we.experience_id = $2
       RETURNING we.experience_id`,
      [userId, experienceId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('EXPERIENCE_NOT_FOUND', 'Work experience record not found')
      );
      return;
    }

    res.status(200).json(
      successResponse({ message: 'Work experience deleted successfully' })
    );
  } catch (error) {
    console.error('Delete work experience error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred deleting work experience')
    );
  }
}

// ============================================================================
// SKILL SCORE MANAGEMENT (Manual entry for MVP)
// ============================================================================

/**
 * Get candidate's skill scores
 * GET /api/v1/profiles/candidate/skills
 */
export async function getCandidateSkills(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;

    // Get all skill scores for the user
    const result = await query(
      `SELECT uss.user_skill_id, uss.user_id, uss.skill_id, uss.score,
              uss.percentile, uss.created_at, uss.expires_at,
              s.name as skill_name, s.category, s.description
       FROM user_skill_scores uss
       JOIN skills s ON uss.skill_id = s.skill_id
       WHERE uss.user_id = $1
       ORDER BY s.category, s.name`,
      [userId]
    );

    res.status(200).json(
      successResponse(
        result.rows.map(row => ({
          user_skill_id: row.user_skill_id,
          user_id: row.user_id,
          skill_id: row.skill_id,
          skill_name: row.skill_name,
          category: row.category,
          description: row.description,
          score: parseFloat(row.score),
          percentile: row.percentile ? parseFloat(row.percentile) : null,
          acquired_at: row.created_at,
          expires_at: row.expires_at,
        }))
      )
    );
  } catch (error) {
    console.error('Get candidate skills error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching skills')
    );
  }
}

/**
 * Add manual skill score for candidate (MVP - no interview)
 * POST /api/v1/profiles/candidate/skills
 */
export async function addCandidateSkill(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { skillId, score } = req.body;

    // Validate required fields
    if (!skillId) {
      res.status(400).json(
        errorResponse('MISSING_SKILL_ID', 'Skill ID is required')
      );
      return;
    }

    if (score === undefined || score === null) {
      res.status(400).json(
        errorResponse('MISSING_SCORE', 'Score is required')
      );
      return;
    }

    // Validate score range
    if (score < 0 || score > 100) {
      res.status(400).json(
        errorResponse('INVALID_SCORE', 'Score must be between 0 and 100')
      );
      return;
    }

    // Verify skill exists
    const skillCheck = await query(
      'SELECT skill_id, name FROM skills WHERE skill_id = $1 AND active = TRUE',
      [skillId]
    );

    if (skillCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('SKILL_NOT_FOUND', 'Skill not found or inactive')
      );
      return;
    }

    // Check if user already has this skill
    const existingSkill = await query(
      'SELECT user_skill_id FROM user_skill_scores WHERE user_id = $1 AND skill_id = $2',
      [userId, skillId]
    );

    if (existingSkill.rows.length > 0) {
      res.status(409).json(
        errorResponse(
          'SKILL_ALREADY_EXISTS',
          'You already have this skill. Use PUT to update the score.',
          { skillId, skillName: skillCheck.rows[0].name }
        )
      );
      return;
    }

    // Set expiry date (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Insert skill score (interview_id is NULL for manual entry in MVP)
    const result = await query(
      `INSERT INTO user_skill_scores (user_id, skill_id, interview_id, score, expires_at)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING *`,
      [userId, skillId, score, expiresAt]
    );

    const skillScore = result.rows[0];

    res.status(201).json(
      successResponse({
        user_skill_id: skillScore.user_skill_id,
        user_id: skillScore.user_id,
        skill_id: skillScore.skill_id,
        skill_name: skillCheck.rows[0].name,
        score: parseFloat(skillScore.score),
        percentile: skillScore.percentile ? parseFloat(skillScore.percentile) : null,
        acquired_at: skillScore.created_at,
        expires_at: skillScore.expires_at,
      })
    );
  } catch (error: any) {
    console.error('Add candidate skill error:', error);

    // Handle unique constraint violation (shouldn't happen due to check above, but just in case)
    if (error.code === '23505') {
      res.status(409).json(
        errorResponse('SKILL_ALREADY_EXISTS', 'You already have this skill')
      );
      return;
    }

    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred adding skill')
    );
  }
}

/**
 * Update manual skill score for candidate
 * PUT /api/v1/profiles/candidate/skills/:skillId
 */
export async function updateCandidateSkill(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { skillId } = req.params;
    const { score } = req.body;

    // Validate score
    if (score === undefined || score === null) {
      res.status(400).json(
        errorResponse('MISSING_SCORE', 'Score is required')
      );
      return;
    }

    if (score < 0 || score > 100) {
      res.status(400).json(
        errorResponse('INVALID_SCORE', 'Score must be between 0 and 100')
      );
      return;
    }

    // Check if skill exists for this user
    const existing = await query(
      'SELECT user_skill_id FROM user_skill_scores WHERE user_id = $1 AND skill_id = $2',
      [userId, skillId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json(
        errorResponse('SKILL_NOT_FOUND', 'You do not have this skill. Use POST to add it.')
      );
      return;
    }

    // Update the score and reset expiry date
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const result = await query(
      `UPDATE user_skill_scores
       SET score = $1, expires_at = $2
       WHERE user_id = $3 AND skill_id = $4
       RETURNING *`,
      [score, expiresAt, userId, skillId]
    );

    const skillScore = result.rows[0];

    // Get skill name
    const skillInfo = await query(
      'SELECT name FROM skills WHERE skill_id = $1',
      [skillId]
    );

    res.status(200).json(
      successResponse({
        user_skill_id: skillScore.user_skill_id,
        user_id: skillScore.user_id,
        skill_id: skillScore.skill_id,
        skill_name: skillInfo.rows[0]?.name,
        score: parseFloat(skillScore.score),
        percentile: skillScore.percentile ? parseFloat(skillScore.percentile) : null,
        acquired_at: skillScore.created_at,
        expires_at: skillScore.expires_at,
      })
    );
  } catch (error) {
    console.error('Update candidate skill error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating skill')
    );
  }
}

/**
 * Delete skill from candidate profile
 * DELETE /api/v1/profiles/candidate/skills/:skillId
 */
export async function deleteCandidateSkill(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const { skillId } = req.params;

    // Check if skill exists for this user
    const existing = await query(
      'SELECT user_skill_id FROM user_skill_scores WHERE user_id = $1 AND skill_id = $2',
      [userId, skillId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json(
        errorResponse('SKILL_NOT_FOUND', 'Skill not found in your profile')
      );
      return;
    }

    // Delete the skill
    await query(
      'DELETE FROM user_skill_scores WHERE user_id = $1 AND skill_id = $2',
      [userId, skillId]
    );

    res.status(200).json(
      successResponse({ message: 'Skill deleted successfully' })
    );
  } catch (error) {
    console.error('Delete candidate skill error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred deleting skill')
    );
  }
}
