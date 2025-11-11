import { Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@jobgraph/common';

/**
 * Create a new job posting
 * POST /api/v1/jobs
 */
export async function createJob(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user.user_id;
    const userRole = user.role;

    // Only employers can create jobs
    if (userRole !== 'employer') {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Only employers can create job postings')
      );
      return;
    }

    const {
      companyId,
      title,
      description,
      requirements,
      city,
      state,
      country,
      remoteOption,
      salaryMin,
      salaryMax,
      salaryCurrency,
      employmentType,
      experienceLevel,
      expiresAt,
    } = req.body;

    // Validate required fields
    if (!companyId || !title || !description) {
      res.status(400).json(
        errorResponse('MISSING_FIELDS', 'Company ID, title, and description are required')
      );
      return;
    }

    // Verify user has access to this company
    const companyCheck = await query(
      'SELECT company_id FROM company_users WHERE company_id = $1 AND user_id = $2',
      [companyId, userId]
    );

    if (companyCheck.rows.length === 0) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'You do not have permission to post jobs for this company')
      );
      return;
    }

    // Create job
    const result = await query(
      `INSERT INTO jobs (
        company_id, posted_by, title, description, requirements,
        city, state, country, remote_option,
        salary_min, salary_max, salary_currency,
        employment_type, experience_level, expires_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft')
      RETURNING job_id, company_id, posted_by, title, description, requirements,
                city, state, country, remote_option,
                salary_min, salary_max, salary_currency,
                employment_type, experience_level, status,
                created_at, updated_at, expires_at`,
      [
        companyId, userId, title, description, requirements,
        city, state, country, remoteOption,
        salaryMin, salaryMax, salaryCurrency || 'USD',
        employmentType, experienceLevel, expiresAt
      ]
    );

    const job = result.rows[0];

    res.status(201).json(
      successResponse({
        jobId: job.job_id,
        companyId: job.company_id,
        postedBy: job.posted_by,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        city: job.city,
        state: job.state,
        country: job.country,
        remoteOption: job.remote_option,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryCurrency: job.salary_currency,
        employmentType: job.employment_type,
        experienceLevel: job.experience_level,
        status: job.status,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        expiresAt: job.expires_at,
      })
    );
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to create job posting')
    );
  }
}

/**
 * Get all jobs with filters
 * GET /api/v1/jobs
 */
export async function getJobs(req: Request, res: Response): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      city,
      state,
      country,
      remoteOption,
      experienceLevel,
      employmentType,
      status = 'active',
      search,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    // Build WHERE clause
    if (status) {
      conditions.push(`j.status = $${paramCount++}`);
      params.push(status);
    }

    if (city) {
      conditions.push(`j.city ILIKE $${paramCount++}`);
      params.push(`%${city}%`);
    }

    if (state) {
      conditions.push(`j.state ILIKE $${paramCount++}`);
      params.push(`%${state}%`);
    }

    if (country) {
      conditions.push(`j.country ILIKE $${paramCount++}`);
      params.push(`%${country}%`);
    }

    if (remoteOption) {
      conditions.push(`j.remote_option = $${paramCount++}`);
      params.push(remoteOption);
    }

    if (experienceLevel) {
      conditions.push(`j.experience_level = $${paramCount++}`);
      params.push(experienceLevel);
    }

    if (employmentType) {
      conditions.push(`j.employment_type = $${paramCount++}`);
      params.push(employmentType);
    }

    if (search) {
      conditions.push(`(j.title ILIKE $${paramCount} OR j.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM jobs j ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get jobs with company info and skill count
    const jobsResult = await query(
      `SELECT j.*, c.name as company_name,
              (SELECT COUNT(*) FROM job_skills js WHERE js.job_id = j.job_id) as required_skills_count
       FROM jobs j
       JOIN companies c ON j.company_id = c.company_id
       ${whereClause}
       ORDER BY j.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, Number(limit), offset]
    );

    const jobs = jobsResult.rows.map((job) => ({
      jobId: job.job_id,
      companyId: job.company_id,
      companyName: job.company_name,
      postedBy: job.posted_by,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      city: job.city,
      state: job.state,
      country: job.country,
      remoteOption: job.remote_option,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      salaryCurrency: job.salary_currency,
      employmentType: job.employment_type,
      experienceLevel: job.experience_level,
      status: job.status,
      views: job.views,
      requiredSkillsCount: parseInt(job.required_skills_count),
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      expiresAt: job.expires_at,
    }));

    res.json(
      successResponse(jobs, {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      })
    );
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve jobs')
    );
  }
}

/**
 * Get a single job by ID
 * GET /api/v1/jobs/:jobId
 */
export async function getJobById(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    // Get job with company info and required skills
    const result = await query(
      `SELECT j.*, c.name as company_name, c.description as company_description,
              c.industry, c.company_size, c.website,
              (SELECT json_agg(
                json_build_object(
                  'skillId', s.skill_id,
                  'skillName', s.name,
                  'category', s.category,
                  'weight', js.weight,
                  'minimumScore', js.minimum_score,
                  'required', js.required
                ) ORDER BY js.weight DESC
              ) FROM job_skills js
              JOIN skills s ON js.skill_id = s.skill_id
              WHERE js.job_id = j.job_id) as required_skills
       FROM jobs j
       JOIN companies c ON j.company_id = c.company_id
       WHERE j.job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found')
      );
      return;
    }

    const job = result.rows[0];

    // Increment view count
    await query('UPDATE jobs SET views = views + 1 WHERE job_id = $1', [jobId]);

    res.json(
      successResponse({
        jobId: job.job_id,
        companyId: job.company_id,
        companyName: job.company_name,
        companyDescription: job.company_description,
        companyIndustry: job.industry,
        companySize: job.company_size,
        companyWebsite: job.website,
        postedBy: job.posted_by,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        city: job.city,
        state: job.state,
        country: job.country,
        remoteOption: job.remote_option,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryCurrency: job.salary_currency,
        employmentType: job.employment_type,
        experienceLevel: job.experience_level,
        status: job.status,
        views: job.views + 1,
        requiredSkills: job.required_skills || [],
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        expiresAt: job.expires_at,
      })
    );
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to retrieve job')
    );
  }
}

/**
 * Update a job
 * PUT /api/v1/jobs/:jobId
 */
export async function updateJob(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user.user_id;
    const { jobId } = req.params;
    const {
      title,
      description,
      requirements,
      city,
      state,
      country,
      remoteOption,
      salaryMin,
      salaryMax,
      salaryCurrency,
      employmentType,
      experienceLevel,
      status,
      expiresAt,
    } = req.body;

    // Verify user owns this job (through company)
    const ownershipCheck = await query(
      `SELECT j.job_id FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'You do not have permission to update this job')
      );
      return;
    }

    // Update job using COALESCE for partial updates
    const result = await query(
      `UPDATE jobs
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           requirements = COALESCE($4, requirements),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           country = COALESCE($7, country),
           remote_option = COALESCE($8, remote_option),
           salary_min = COALESCE($9, salary_min),
           salary_max = COALESCE($10, salary_max),
           salary_currency = COALESCE($11, salary_currency),
           employment_type = COALESCE($12, employment_type),
           experience_level = COALESCE($13, experience_level),
           status = COALESCE($14, status),
           expires_at = COALESCE($15, expires_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $1
       RETURNING *`,
      [
        jobId, title, description, requirements,
        city, state, country, remoteOption,
        salaryMin, salaryMax, salaryCurrency,
        employmentType, experienceLevel, status, expiresAt
      ]
    );

    const job = result.rows[0];

    res.json(
      successResponse({
        jobId: job.job_id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        city: job.city,
        state: job.state,
        country: job.country,
        remoteOption: job.remote_option,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryCurrency: job.salary_currency,
        employmentType: job.employment_type,
        experienceLevel: job.experience_level,
        status: job.status,
        updatedAt: job.updated_at,
        expiresAt: job.expires_at,
      })
    );
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to update job')
    );
  }
}

/**
 * Delete (close/cancel) a job
 * DELETE /api/v1/jobs/:jobId
 */
export async function deleteJob(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user.user_id;
    const { jobId } = req.params;

    // Verify user owns this job (through company)
    const ownershipCheck = await query(
      `SELECT j.job_id FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'You do not have permission to delete this job')
      );
      return;
    }

    // Set status to 'cancelled' instead of deleting
    await query(
      `UPDATE jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE job_id = $1`,
      [jobId]
    );

    res.json(
      successResponse({
        message: 'Job cancelled successfully',
      })
    );
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to cancel job')
    );
  }
}

/**
 * Add a required skill to a job
 * POST /api/v1/jobs/:jobId/skills
 */
export async function addJobSkill(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user.user_id;
    const { jobId } = req.params;
    const { skillId, weight, minimumScore, required } = req.body;

    // Validate required fields
    if (!skillId) {
      res.status(400).json(
        errorResponse('MISSING_FIELDS', 'Skill ID is required')
      );
      return;
    }

    // Verify user owns this job
    const ownershipCheck = await query(
      `SELECT j.job_id FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'You do not have permission to modify this job')
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

    // Add job skill
    const result = await query(
      `INSERT INTO job_skills (job_id, skill_id, weight, minimum_score, required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING job_skill_id, job_id, skill_id, weight, minimum_score, required, created_at`,
      [jobId, skillId, weight || 1.0, minimumScore || 60.0, required !== false]
    );

    const jobSkill = result.rows[0];
    const skill = skillCheck.rows[0];

    res.status(201).json(
      successResponse({
        jobSkillId: jobSkill.job_skill_id,
        jobId: jobSkill.job_id,
        skillId: jobSkill.skill_id,
        skillName: skill.name,
        weight: parseFloat(jobSkill.weight),
        minimumScore: parseFloat(jobSkill.minimum_score),
        required: jobSkill.required,
        createdAt: jobSkill.created_at,
      })
    );
  } catch (error: any) {
    console.error('Add job skill error:', error);

    // Handle unique constraint violation (duplicate skill)
    if (error.code === '23505') {
      res.status(400).json(
        errorResponse('SKILL_ALREADY_ADDED', 'This skill has already been added to the job')
      );
      return;
    }

    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to add skill to job')
    );
  }
}

/**
 * Update a job skill requirement
 * PUT /api/v1/jobs/:jobId/skills/:skillId
 */
export async function updateJobSkill(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user.user_id;
    const { jobId, skillId } = req.params;
    const { weight, minimumScore, required } = req.body;

    // Verify user owns this job
    const ownershipCheck = await query(
      `SELECT j.job_id FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'You do not have permission to modify this job')
      );
      return;
    }

    // Update job skill
    const result = await query(
      `UPDATE job_skills
       SET weight = COALESCE($3, weight),
           minimum_score = COALESCE($4, minimum_score),
           required = COALESCE($5, required)
       WHERE job_id = $1 AND skill_id = $2
       RETURNING *`,
      [jobId, skillId, weight, minimumScore, required]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('JOB_SKILL_NOT_FOUND', 'This skill is not associated with the job')
      );
      return;
    }

    const jobSkill = result.rows[0];

    res.json(
      successResponse({
        jobSkillId: jobSkill.job_skill_id,
        jobId: jobSkill.job_id,
        skillId: jobSkill.skill_id,
        weight: parseFloat(jobSkill.weight),
        minimumScore: parseFloat(jobSkill.minimum_score),
        required: jobSkill.required,
      })
    );
  } catch (error) {
    console.error('Update job skill error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to update job skill')
    );
  }
}

/**
 * Remove a skill from a job
 * DELETE /api/v1/jobs/:jobId/skills/:skillId
 */
export async function deleteJobSkill(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userId = user.user_id;
    const { jobId, skillId } = req.params;

    // Verify user owns this job
    const ownershipCheck = await query(
      `SELECT j.job_id FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'You do not have permission to modify this job')
      );
      return;
    }

    // Delete job skill
    const result = await query(
      'DELETE FROM job_skills WHERE job_id = $1 AND skill_id = $2 RETURNING job_skill_id',
      [jobId, skillId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('JOB_SKILL_NOT_FOUND', 'This skill is not associated with the job')
      );
      return;
    }

    res.json(
      successResponse({
        message: 'Skill removed from job successfully',
      })
    );
  } catch (error) {
    console.error('Delete job skill error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'Failed to remove skill from job')
    );
  }
}
