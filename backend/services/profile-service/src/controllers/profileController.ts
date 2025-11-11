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
