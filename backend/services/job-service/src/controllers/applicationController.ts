import { Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@jobgraph/common';

/**
 * Apply to a job
 * Candidates can apply to any active job with optional cover letter
 */
export async function applyToJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { coverLetter, resumeUrl } = req.body;
    const userId = (req as any).user.user_id;

    // Verify user is a candidate
    const userCheck = await query(
      'SELECT role FROM users WHERE user_id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'candidate') {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Only candidates can apply to jobs')
      );
      return;
    }

    // Verify job exists and is active
    const jobCheck = await query(
      'SELECT job_id, title, status FROM jobs WHERE job_id = $1',
      [jobId]
    );

    if (jobCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found')
      );
      return;
    }

    if (jobCheck.rows[0].status !== 'active') {
      res.status(400).json(
        errorResponse('JOB_NOT_ACTIVE', 'This job is not accepting applications')
      );
      return;
    }

    // Check if already applied
    const existingApplication = await query(
      'SELECT application_id FROM job_applications WHERE job_id = $1 AND user_id = $2',
      [jobId, userId]
    );

    if (existingApplication.rows.length > 0) {
      res.status(409).json(
        errorResponse('ALREADY_APPLIED', 'You have already applied to this job')
      );
      return;
    }

    // Create application
    const result = await query(
      `INSERT INTO job_applications (job_id, user_id, cover_letter, resume_url, status)
       VALUES ($1, $2, $3, $4, 'submitted')
       RETURNING application_id, job_id, user_id, cover_letter, resume_url, status, applied_at, updated_at`,
      [jobId, userId, coverLetter || null, resumeUrl || null]
    );

    const application = result.rows[0];

    res.status(201).json(
      successResponse({
        applicationId: application.application_id,
        jobId: application.job_id,
        userId: application.user_id,
        coverLetter: application.cover_letter,
        resumeUrl: application.resume_url,
        status: application.status,
        appliedAt: application.applied_at,
        updatedAt: application.updated_at,
      })
    );
  } catch (error: any) {
    console.error('Apply to job error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred while applying to the job')
    );
  }
}

/**
 * Get all applications for the current candidate
 * Supports pagination and filtering by status
 */
export async function getMyApplications(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    // Build query with optional status filter
    let whereClause = 'WHERE ja.user_id = $1';
    const params: any[] = [userId];

    if (status) {
      whereClause += ' AND ja.status = $2';
      params.push(status);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM job_applications ja ${whereClause}`,
      params
    );
    const totalApplications = parseInt(countResult.rows[0].count);

    // Get applications with job and company details
    const applicationsResult = await query(
      `SELECT
         ja.application_id,
         ja.job_id,
         ja.cover_letter,
         ja.resume_url,
         ja.status,
         ja.applied_at,
         ja.reviewed_at,
         ja.updated_at,
         j.title as job_title,
         j.description as job_description,
         j.city,
         j.state,
         j.remote_option,
         j.salary_min,
         j.salary_max,
         j.salary_currency,
         j.employment_type,
         j.experience_level,
         c.company_id,
         c.name as company_name,
         c.industry,
         jm.overall_score as match_score,
         jm.match_rank
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.job_id
       JOIN companies c ON j.company_id = c.company_id
       LEFT JOIN job_matches jm ON ja.job_id = jm.job_id AND ja.user_id = jm.user_id
       ${whereClause}
       ORDER BY ja.applied_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const applications = applicationsResult.rows.map(app => ({
      applicationId: app.application_id,
      jobId: app.job_id,
      jobTitle: app.job_title,
      jobDescription: app.job_description,
      location: {
        city: app.city,
        state: app.state,
      },
      remoteOption: app.remote_option,
      salary: {
        min: app.salary_min,
        max: app.salary_max,
        currency: app.salary_currency,
      },
      employmentType: app.employment_type,
      experienceLevel: app.experience_level,
      company: {
        companyId: app.company_id,
        name: app.company_name,
        industry: app.industry,
      },
      coverLetter: app.cover_letter,
      resumeUrl: app.resume_url,
      status: app.status,
      appliedAt: app.applied_at,
      reviewedAt: app.reviewed_at,
      updatedAt: app.updated_at,
      matchScore: app.match_score ? parseFloat(app.match_score) : null,
      matchRank: app.match_rank,
    }));

    res.status(200).json(
      successResponse(
        {
          totalApplications,
          applications,
        },
        {
          page,
          limit,
          total: totalApplications,
          pages: Math.ceil(totalApplications / limit),
        }
      )
    );
  } catch (error: any) {
    console.error('Get my applications error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching applications')
    );
  }
}

/**
 * Get a specific application by ID
 */
export async function getApplicationById(req: Request, res: Response): Promise<void> {
  try {
    const { applicationId } = req.params;
    const userId = (req as any).user.user_id;

    // Get application with full details
    const result = await query(
      `SELECT
         ja.application_id,
         ja.job_id,
         ja.user_id,
         ja.cover_letter,
         ja.resume_url,
         ja.custom_responses,
         ja.status,
         ja.applied_at,
         ja.reviewed_at,
         ja.updated_at,
         j.title as job_title,
         j.description as job_description,
         j.requirements,
         j.responsibilities,
         j.city,
         j.state,
         j.country,
         j.remote_option,
         j.salary_min,
         j.salary_max,
         j.salary_currency,
         j.employment_type,
         j.experience_level,
         c.company_id,
         c.name as company_name,
         c.industry,
         c.description as company_description,
         jm.overall_score as match_score,
         jm.match_rank,
         jm.skill_breakdown
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.job_id
       JOIN companies c ON j.company_id = c.company_id
       LEFT JOIN job_matches jm ON ja.job_id = jm.job_id AND ja.user_id = jm.user_id
       WHERE ja.application_id = $1 AND ja.user_id = $2`,
      [applicationId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('APPLICATION_NOT_FOUND', 'Application not found')
      );
      return;
    }

    const app = result.rows[0];

    res.status(200).json(
      successResponse({
        applicationId: app.application_id,
        jobId: app.job_id,
        userId: app.user_id,
        job: {
          title: app.job_title,
          description: app.job_description,
          requirements: app.requirements,
          responsibilities: app.responsibilities,
          location: {
            city: app.city,
            state: app.state,
            country: app.country,
          },
          remoteOption: app.remote_option,
          salary: {
            min: app.salary_min,
            max: app.salary_max,
            currency: app.salary_currency,
          },
          employmentType: app.employment_type,
          experienceLevel: app.experience_level,
        },
        company: {
          companyId: app.company_id,
          name: app.company_name,
          industry: app.industry,
          description: app.company_description,
        },
        coverLetter: app.cover_letter,
        resumeUrl: app.resume_url,
        customResponses: app.custom_responses,
        status: app.status,
        appliedAt: app.applied_at,
        reviewedAt: app.reviewed_at,
        updatedAt: app.updated_at,
        matchScore: app.match_score ? parseFloat(app.match_score) : null,
        matchRank: app.match_rank,
        skillBreakdown: app.skill_breakdown,
      })
    );
  } catch (error: any) {
    console.error('Get application by ID error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching application')
    );
  }
}

/**
 * Withdraw an application
 * Only allowed if status is 'submitted' or 'under_review'
 */
export async function withdrawApplication(req: Request, res: Response): Promise<void> {
  try {
    const { applicationId } = req.params;
    const userId = (req as any).user.user_id;

    // Check if application exists and belongs to user
    const appCheck = await query(
      'SELECT application_id, status FROM job_applications WHERE application_id = $1 AND user_id = $2',
      [applicationId, userId]
    );

    if (appCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('APPLICATION_NOT_FOUND', 'Application not found')
      );
      return;
    }

    const currentStatus = appCheck.rows[0].status;

    // Only allow withdrawal for submitted or under_review applications
    if (!['submitted', 'under_review'].includes(currentStatus)) {
      res.status(400).json(
        errorResponse(
          'CANNOT_WITHDRAW',
          `Cannot withdraw application with status: ${currentStatus}`
        )
      );
      return;
    }

    // Update status to withdrawn
    await query(
      `UPDATE job_applications
       SET status = 'withdrawn', updated_at = NOW()
       WHERE application_id = $1`,
      [applicationId]
    );

    res.status(200).json(
      successResponse({
        applicationId,
        status: 'withdrawn',
        message: 'Application withdrawn successfully',
      })
    );
  } catch (error: any) {
    console.error('Withdraw application error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred withdrawing application')
    );
  }
}
