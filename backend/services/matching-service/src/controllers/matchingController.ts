import { Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@jobgraph/common';

/**
 * Calculate job matches for a specific job
 * Finds candidates with ALL required skills, checks minimum thresholds,
 * calculates weighted average scores, and stores matches
 */
export async function calculateJobMatches(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user.user_id;

    // Verify job exists and user has permission (must be employer and job owner)
    const jobCheck = await query(
      `SELECT j.job_id, j.company_id, cu.user_id
       FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (jobCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found or you do not have permission')
      );
      return;
    }

    // Get job with required skills
    const jobSkillsResult = await query(
      `SELECT js.skill_id, js.weight, js.minimum_score, js.required, s.name
       FROM job_skills js
       JOIN skills s ON js.skill_id = s.skill_id
       WHERE js.job_id = $1`,
      [jobId]
    );

    const jobSkills = jobSkillsResult.rows;

    if (jobSkills.length === 0) {
      res.status(400).json(
        errorResponse('NO_SKILLS', 'Job must have at least one skill requirement')
      );
      return;
    }

    // Get required skills only
    const requiredSkills = jobSkills.filter(js => js.required);
    const requiredSkillIds = requiredSkills.map(js => js.skill_id);

    if (requiredSkillIds.length === 0) {
      res.status(400).json(
        errorResponse('NO_REQUIRED_SKILLS', 'Job must have at least one required skill')
      );
      return;
    }

    // Find candidates who have ALL required skills and meet minimum thresholds
    // This query finds candidates with valid (non-expired) skill scores
    const candidatesResult = await query(
      `SELECT
         u.user_id,
         u.email,
         cp.profile_id,
         cp.headline,
         cp.years_experience,
         cp.city,
         cp.state,
         cp.willing_to_relocate,
         cp.remote_preference,
         ARRAY_AGG(
           json_build_object(
             'skill_id', uss.skill_id,
             'skill_name', s.name,
             'score', uss.score,
             'percentile', uss.percentile,
             'expires_at', uss.expires_at
           )
         ) as skills
       FROM users u
       JOIN candidate_profiles cp ON u.user_id = cp.user_id
       JOIN user_skill_scores uss ON u.user_id = uss.user_id
       JOIN skills s ON uss.skill_id = s.skill_id
       WHERE u.role = 'candidate'
         AND cp.profile_visibility != 'private'
         AND uss.expires_at > NOW()
         AND uss.skill_id = ANY($1)
       GROUP BY u.user_id, u.email, cp.profile_id, cp.headline, cp.years_experience,
                cp.city, cp.state, cp.willing_to_relocate, cp.remote_preference
       HAVING COUNT(DISTINCT uss.skill_id) = $2`,
      [requiredSkillIds, requiredSkillIds.length]
    );

    const candidates = candidatesResult.rows;

    // Calculate match scores for each candidate
    const matches = [];

    for (const candidate of candidates) {
      const candidateSkills = candidate.skills;

      // Check if candidate meets ALL minimum thresholds for required skills
      let meetsThresholds = true;
      let totalWeightedScore = 0;
      let totalWeight = 0;
      const skillBreakdown = [];

      for (const jobSkill of jobSkills) {
        const candidateSkill = candidateSkills.find(
          (cs: any) => cs.skill_id === jobSkill.skill_id
        );

        if (jobSkill.required) {
          // Required skill - candidate must have it (already filtered) and meet threshold
          if (!candidateSkill || parseFloat(candidateSkill.score) < parseFloat(jobSkill.minimum_score)) {
            meetsThresholds = false;
            break;
          }

          const score = parseFloat(candidateSkill.score);
          const weight = parseFloat(jobSkill.weight);

          totalWeightedScore += score * weight;
          totalWeight += weight;

          skillBreakdown.push({
            skillId: jobSkill.skill_id,
            skillName: jobSkill.name,
            required: true,
            candidateScore: score,
            minimumScore: parseFloat(jobSkill.minimum_score),
            weight: weight,
            meetsThreshold: true,
          });
        } else if (candidateSkill) {
          // Optional skill - if candidate has it, include in scoring
          const score = parseFloat(candidateSkill.score);
          const weight = parseFloat(jobSkill.weight);

          totalWeightedScore += score * weight;
          totalWeight += weight;

          skillBreakdown.push({
            skillId: jobSkill.skill_id,
            skillName: jobSkill.name,
            required: false,
            candidateScore: score,
            minimumScore: parseFloat(jobSkill.minimum_score),
            weight: weight,
            meetsThreshold: score >= parseFloat(jobSkill.minimum_score),
          });
        }
      }

      // Only include candidates who meet all thresholds
      if (meetsThresholds && totalWeight > 0) {
        const overallScore = totalWeightedScore / totalWeight;

        matches.push({
          userId: candidate.user_id,
          email: candidate.email,
          profileId: candidate.profile_id,
          headline: candidate.headline,
          yearsExperience: candidate.years_experience,
          location: {
            city: candidate.city,
            state: candidate.state,
          },
          willingToRelocate: candidate.willing_to_relocate,
          remotePreference: candidate.remote_preference,
          overallScore: overallScore,
          skillBreakdown: skillBreakdown,
          rank: 0, // Will be assigned after sorting
        });
      }
    }

    // Sort matches by overall score (descending)
    matches.sort((a, b) => b.overallScore - a.overallScore);

    // Assign ranks
    matches.forEach((match, index) => {
      match.rank = index + 1;
    });

    // Delete existing matches for this job
    await query('DELETE FROM job_matches WHERE job_id = $1', [jobId]);

    // Insert new matches into database
    for (const match of matches) {
      await query(
        `INSERT INTO job_matches (job_id, user_id, overall_score, match_rank, skill_breakdown, status)
         VALUES ($1, $2, $3, $4, $5, 'matched')`,
        [
          jobId,
          match.userId,
          match.overallScore,
          match.rank,
          JSON.stringify(match.skillBreakdown),
        ]
      );
    }

    res.status(200).json(
      successResponse({
        jobId: jobId,
        totalMatches: matches.length,
        topMatches: matches.slice(0, 10), // Return top 10 for preview
      })
    );
  } catch (error: any) {
    console.error('Calculate job matches error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred calculating matches')
    );
  }
}

/**
 * Get ranked candidate matches for a job (Employer view)
 */
export async function getJobCandidates(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user.user_id;

    // Verify job exists and user has permission
    const jobCheck = await query(
      `SELECT j.job_id, j.title, j.company_id
       FROM jobs j
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE j.job_id = $1 AND cu.user_id = $2`,
      [jobId, userId]
    );

    if (jobCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('JOB_NOT_FOUND', 'Job not found or you do not have permission')
      );
      return;
    }

    // Get matches for this job, including application data if exists
    const matchesResult = await query(
      `SELECT
         jm.match_id,
         jm.user_id,
         jm.overall_score,
         jm.match_rank,
         jm.skill_breakdown,
         jm.status,
         jm.contacted_at,
         jm.created_at,
         u.email,
         u.first_name,
         u.last_name,
         cp.profile_id,
         cp.headline,
         cp.years_experience,
         cp.city,
         cp.state,
         cp.willing_to_relocate,
         cp.remote_preference,
         ja.application_id,
         ja.applied_at,
         ja.cover_letter,
         ja.status as application_status,
         ja.reviewed_at
       FROM job_matches jm
       JOIN users u ON jm.user_id = u.user_id
       JOIN candidate_profiles cp ON u.user_id = cp.user_id
       LEFT JOIN job_applications ja ON jm.job_id = ja.job_id AND jm.user_id = ja.user_id
       WHERE jm.job_id = $1
       ORDER BY jm.match_rank ASC`,
      [jobId]
    );

    const matches = matchesResult.rows.map(match => ({
      matchId: match.match_id,
      userId: match.user_id,
      firstName: match.first_name,
      lastName: match.last_name,
      email: match.email,
      profileId: match.profile_id,
      overallScore: parseFloat(match.overall_score),
      rank: match.match_rank,
      status: match.status,
      contactedAt: match.contacted_at,
      profile: {
        headline: match.headline,
        summary: null, // Not selected in current query
        yearsOfExperience: match.years_experience,
        city: match.city,
        state: match.state,
        remotePreference: match.remote_preference,
      },
      skillBreakdown: match.skill_breakdown,
      createdAt: match.created_at,
      // Application data (if candidate has applied)
      hasApplied: !!match.application_id,
      applicationId: match.application_id,
      appliedAt: match.applied_at,
      coverLetter: match.cover_letter,
      applicationStatus: match.application_status,
      applicationReviewedAt: match.reviewed_at,
      source: match.application_id ? 'both' : 'matched',
    }));

    res.status(200).json(
      successResponse({
        jobId: jobId,
        jobTitle: jobCheck.rows[0].title,
        totalMatches: matches.length,
        candidates: matches,
      })
    );
  } catch (error: any) {
    console.error('Get job candidates error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching candidates')
    );
  }
}

/**
 * Get job matches for a candidate (Candidate view)
 */
export async function getCandidateMatches(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;

    // Get all matches for this candidate
    const matchesResult = await query(
      `SELECT
         jm.match_id,
         jm.job_id,
         jm.overall_score,
         jm.match_rank,
         jm.skill_breakdown,
         jm.status,
         jm.contacted_at,
         jm.created_at,
         j.title,
         j.description,
         j.city,
         j.state,
         j.remote_option,
         j.salary_min,
         j.salary_max,
         j.employment_type,
         j.experience_level,
         c.company_id,
         c.name as company_name,
         c.industry
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.job_id
       JOIN companies c ON j.company_id = c.company_id
       WHERE jm.user_id = $1
       ORDER BY jm.overall_score DESC`,
      [userId]
    );

    const matches = matchesResult.rows.map(match => ({
      matchId: match.match_id,
      jobId: match.job_id,
      jobTitle: match.title,
      jobDescription: match.description,
      location: {
        city: match.city,
        state: match.state,
      },
      remoteOption: match.remote_option,
      salary: {
        min: match.salary_min,
        max: match.salary_max,
      },
      employmentType: match.employment_type,
      experienceLevel: match.experience_level,
      company: {
        companyId: match.company_id,
        name: match.company_name,
        industry: match.industry,
      },
      overallScore: parseFloat(match.overall_score),
      rank: match.match_rank,
      skillBreakdown: match.skill_breakdown,
      status: match.status,
      contactedAt: match.contacted_at,
      matchedAt: match.created_at,
    }));

    res.status(200).json(
      successResponse({
        totalMatches: matches.length,
        matches: matches,
      })
    );
  } catch (error: any) {
    console.error('Get candidate matches error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching matches')
    );
  }
}

/**
 * Update match status
 */
export async function updateMatchStatus(req: Request, res: Response): Promise<void> {
  try {
    const { matchId } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.user_id;

    // Validate status (must match database constraint)
    const validStatuses = ['matched', 'viewed', 'contacted', 'shortlisted', 'rejected', 'hired'];
    if (!validStatuses.includes(status)) {
      res.status(400).json(
        errorResponse('INVALID_STATUS', `Status must be one of: ${validStatuses.join(', ')}`)
      );
      return;
    }

    // Verify match exists and user has permission (employer only)
    const matchCheck = await query(
      `SELECT jm.match_id, jm.job_id
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.job_id
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE jm.match_id = $1 AND cu.user_id = $2`,
      [matchId, userId]
    );

    if (matchCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('MATCH_NOT_FOUND', 'Match not found or you do not have permission')
      );
      return;
    }

    // Update match status
    const result = await query(
      `UPDATE job_matches
       SET status = $1, updated_at = NOW()
       WHERE match_id = $2
       RETURNING *`,
      [status, matchId]
    );

    res.status(200).json(
      successResponse({
        matchId: result.rows[0].match_id,
        status: result.rows[0].status,
        updatedAt: result.rows[0].updated_at,
      })
    );
  } catch (error: any) {
    console.error('Update match status error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating match status')
    );
  }
}

/**
 * Contact a candidate (marks as contacted)
 */
export async function contactCandidate(req: Request, res: Response): Promise<void> {
  try {
    const { matchId } = req.params;
    const userId = (req as any).user.user_id;

    // Verify match exists and user has permission (employer only)
    const matchCheck = await query(
      `SELECT jm.match_id, jm.job_id, jm.user_id
       FROM job_matches jm
       JOIN jobs j ON jm.job_id = j.job_id
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE jm.match_id = $1 AND cu.user_id = $2`,
      [matchId, userId]
    );

    if (matchCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('MATCH_NOT_FOUND', 'Match not found or you do not have permission')
      );
      return;
    }

    // Update match status to 'contacted' and set contacted_at timestamp
    const result = await query(
      `UPDATE job_matches
       SET status = 'contacted', contacted_at = NOW(), updated_at = NOW()
       WHERE match_id = $1
       RETURNING *`,
      [matchId]
    );

    // TODO: In Phase 2, send notification to candidate via Notification Service

    res.status(200).json(
      successResponse({
        matchId: result.rows[0].match_id,
        status: result.rows[0].status,
        contactedAt: result.rows[0].contacted_at,
        message: 'Candidate has been marked as contacted',
      })
    );
  } catch (error: any) {
    console.error('Contact candidate error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred contacting candidate')
    );
  }
}

/**
 * Browse all jobs with calculated match scores (Candidate view)
 * Unlike getCandidateMatches which only shows stored matches from job_matches table,
 * this endpoint calculates a score for EVERY active job, even partial matches
 */
export async function browseJobsWithScores(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;

    // Get candidate's current skills with scores
    const candidateSkillsResult = await query(
      `SELECT uss.skill_id, s.name, uss.score
       FROM user_skill_scores uss
       JOIN skills s ON uss.skill_id = s.skill_id
       WHERE uss.user_id = $1 AND uss.expires_at > NOW()`,
      [userId]
    );

    const candidateSkills = candidateSkillsResult.rows;

    if (candidateSkills.length === 0) {
      res.status(200).json(
        successResponse({
          totalJobs: 0,
          jobs: [],
          message: 'Add skills to your profile to see job matches',
        })
      );
      return;
    }

    // Create a map of candidate's skills for quick lookup
    const candidateSkillMap = new Map();
    candidateSkills.forEach(skill => {
      candidateSkillMap.set(skill.skill_id, parseFloat(skill.score));
    });

    // Get all active jobs with their skill requirements
    const jobsResult = await query(
      `SELECT
         j.job_id,
         j.title,
         j.description,
         j.city,
         j.state,
         j.remote_option,
         j.salary_min,
         j.salary_max,
         j.employment_type,
         j.experience_level,
         j.created_at,
         c.company_id,
         c.name as company_name,
         c.industry,
         ARRAY_AGG(
           json_build_object(
             'skill_id', js.skill_id,
             'skill_name', s.name,
             'weight', js.weight,
             'minimum_score', js.minimum_score,
             'required', js.required
           )
         ) as skills
       FROM jobs j
       JOIN companies c ON j.company_id = c.company_id
       JOIN job_skills js ON j.job_id = js.job_id
       JOIN skills s ON js.skill_id = s.skill_id
       WHERE j.status = 'active'
       GROUP BY j.job_id, j.title, j.description, j.city, j.state, j.remote_option,
                j.salary_min, j.salary_max, j.employment_type, j.experience_level,
                j.created_at, c.company_id, c.name, c.industry
       ORDER BY j.created_at DESC`
    );

    const jobs = jobsResult.rows;

    // Get candidate profile for additional matching factors
    const profileResult = await query(
      `SELECT
         cp.years_experience,
         cp.city,
         cp.state,
         cp.remote_preference,
         cp.willing_to_relocate,
         COALESCE(
           (SELECT json_agg(json_build_object(
             'degree', e.degree,
             'field_of_study', e.field_of_study,
             'graduation_year', e.graduation_year
           ))
           FROM education e WHERE e.profile_id = cp.profile_id),
           '[]'::json
         ) as education,
         COALESCE(
           (SELECT json_agg(json_build_object(
             'title', we.title,
             'company', we.company,
             'years', EXTRACT(YEAR FROM AGE(
               COALESCE(we.end_date, NOW()), we.start_date
             ))
           ))
           FROM work_experience we WHERE we.profile_id = cp.profile_id),
           '[]'::json
         ) as work_experience
       FROM candidate_profiles cp
       WHERE cp.user_id = $1`,
      [userId]
    );

    const profile = profileResult.rows[0] || {};

    // Calculate match score for each job
    const jobsWithScores = jobs.map(job => {
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let requiredSkillsMet = 0;
      let totalRequiredSkills = 0;
      const skillBreakdown = [];

      for (const jobSkill of job.skills) {
        const candidateScore = candidateSkillMap.get(jobSkill.skill_id) || 0;
        const weight = parseFloat(jobSkill.weight);
        const minimumScore = parseFloat(jobSkill.minimum_score);
        const meetsThreshold = candidateScore >= minimumScore;

        if (jobSkill.required) {
          totalRequiredSkills++;
          if (candidateScore > 0 && meetsThreshold) {
            requiredSkillsMet++;
          }
        }

        // Include skill in scoring if candidate has it (even if below threshold)
        if (candidateScore > 0) {
          totalWeightedScore += candidateScore * weight;
          totalWeight += weight;
        }

        skillBreakdown.push({
          skillId: jobSkill.skill_id,
          skillName: jobSkill.skill_name,
          required: jobSkill.required,
          candidateScore: candidateScore,
          minimumScore: minimumScore,
          weight: weight,
          meetsThreshold: meetsThreshold,
        });
      }

      // Calculate base skill score (0 if no overlap)
      let skillScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

      // Apply penalty for missing required skills
      // If you're missing required skills, reduce the score significantly
      const requiredSkillsRatio = totalRequiredSkills > 0 ? requiredSkillsMet / totalRequiredSkills : 1;

      // If missing any required skills, cap the score based on how many you're missing
      // 0/2 required = max 25%, 1/2 required = max 50%, 2/2 required = no cap
      if (requiredSkillsMet < totalRequiredSkills) {
        const maxScore = requiredSkillsRatio * 50 + 25; // 0->25%, 0.5->50%, 1->75%+
        skillScore = Math.min(skillScore, maxScore);
      }

      // Calculate additional factors (up to 15 bonus points)
      let bonusPoints = 0;

      // Experience match (0-5 points)
      if (profile.years_experience && job.experience_level) {
        const yearsExp = parseInt(profile.years_experience);
        const expLevel = job.experience_level;

        if (
          (expLevel === 'entry' && yearsExp >= 0 && yearsExp <= 3) ||
          (expLevel === 'mid' && yearsExp >= 2 && yearsExp <= 6) ||
          (expLevel === 'senior' && yearsExp >= 5 && yearsExp <= 10) ||
          (expLevel === 'lead' && yearsExp >= 8) ||
          (expLevel === 'executive' && yearsExp >= 10)
        ) {
          bonusPoints += 5;
        } else if (
          (expLevel === 'entry' && yearsExp <= 5) ||
          (expLevel === 'mid' && yearsExp >= 1 && yearsExp <= 8) ||
          (expLevel === 'senior' && yearsExp >= 3)
        ) {
          bonusPoints += 2;
        }
      }

      // Location match (0-5 points)
      if (job.remote_option) {
        // Remote job
        if (profile.remote_preference === 'remote' || profile.remote_preference === 'flexible') {
          bonusPoints += 5;
        } else if (profile.remote_preference === 'hybrid') {
          bonusPoints += 3;
        }
      } else if (job.city && job.state && profile.city && profile.state) {
        // On-site job
        if (job.city === profile.city && job.state === profile.state) {
          bonusPoints += 5; // Same city
        } else if (job.state === profile.state) {
          if (profile.willing_to_relocate) {
            bonusPoints += 3; // Same state, willing to relocate
          } else {
            bonusPoints += 1; // Same state but not willing to relocate
          }
        } else if (profile.willing_to_relocate) {
          bonusPoints += 2; // Different state but willing to relocate
        }
      }

      // Education relevance (0-3 points)
      if (profile.education && Array.isArray(profile.education) && profile.education.length > 0) {
        const hasRelevantDegree = profile.education.some((edu: any) => {
          const field = (edu.field_of_study || '').toLowerCase();
          const jobDesc = (job.description || '').toLowerCase();
          const jobTitle = (job.title || '').toLowerCase();

          // Check if field of study is mentioned in job title or description
          return field.length > 3 && (jobDesc.includes(field) || jobTitle.includes(field));
        });

        if (hasRelevantDegree) {
          bonusPoints += 3;
        } else if (profile.education.some((e: any) => e.degree === 'bachelors' || e.degree === 'masters' || e.degree === 'phd')) {
          bonusPoints += 1; // Has degree but not directly relevant
        }
      }

      // Work experience relevance (0-2 points)
      if (profile.work_experience && Array.isArray(profile.work_experience) && profile.work_experience.length > 0) {
        const hasRelevantExperience = profile.work_experience.some((exp: any) => {
          const title = (exp.title || '').toLowerCase();
          const jobTitle = (job.title || '').toLowerCase();

          // Check for similar job titles or keywords
          const keywords = jobTitle.split(' ').filter((w: string) => w.length > 3);
          return keywords.some((keyword: string) => title.includes(keyword));
        });

        if (hasRelevantExperience) {
          bonusPoints += 2;
        }
      }

      // Calculate final overall score: skill score (max 100) + bonus points (max 15)
      // Then normalize back to 0-100 scale
      const rawScore = skillScore + bonusPoints;
      const overallScore = Math.min(rawScore, 100);

      // Determine qualification status
      const isFullyQualified = requiredSkillsMet === totalRequiredSkills && totalRequiredSkills > 0;

      return {
        jobId: job.job_id,
        jobTitle: job.title,
        jobDescription: job.description,
        location: {
          city: job.city,
          state: job.state,
        },
        remoteOption: job.remote_option,
        salary: {
          min: job.salary_min,
          max: job.salary_max,
        },
        employmentType: job.employment_type,
        experienceLevel: job.experience_level,
        company: {
          companyId: job.company_id,
          name: job.company_name,
          industry: job.industry,
        },
        overallScore: overallScore,
        isFullyQualified: isFullyQualified,
        requiredSkillsMet: requiredSkillsMet,
        totalRequiredSkills: totalRequiredSkills,
        skillBreakdown: skillBreakdown,
        postedAt: job.created_at,
      };
    });

    // Sort by overall score (descending)
    jobsWithScores.sort((a, b) => b.overallScore - a.overallScore);

    res.status(200).json(
      successResponse({
        totalJobs: jobsWithScores.length,
        jobs: jobsWithScores,
      })
    );
  } catch (error: any) {
    console.error('Browse jobs with scores error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred browsing jobs')
    );
  }
}

/**
 * Get application details (Employer view)
 * Allows employer to view full application including cover letter
 */
export async function getApplicationDetails(req: Request, res: Response): Promise<void> {
  try {
    const { applicationId } = req.params;
    const userId = (req as any).user.user_id;

    // Verify application exists and employer has permission (owns the job)
    const appResult = await query(
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
         u.email,
         u.first_name,
         u.last_name,
         cp.profile_id,
         cp.headline,
         cp.summary,
         cp.years_experience,
         cp.city,
         cp.state,
         cp.remote_preference,
         j.title as job_title,
         j.company_id,
         jm.overall_score,
         jm.match_rank,
         jm.skill_breakdown
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.job_id
       JOIN company_users cu ON j.company_id = cu.company_id
       JOIN users u ON ja.user_id = u.user_id
       JOIN candidate_profiles cp ON u.user_id = cp.user_id
       LEFT JOIN job_matches jm ON ja.job_id = jm.job_id AND ja.user_id = jm.user_id
       WHERE ja.application_id = $1 AND cu.user_id = $2`,
      [applicationId, userId]
    );

    if (appResult.rows.length === 0) {
      res.status(404).json(
        errorResponse('APPLICATION_NOT_FOUND', 'Application not found or you do not have permission')
      );
      return;
    }

    const app = appResult.rows[0];

    // Mark as reviewed if not already
    if (!app.reviewed_at) {
      await query(
        `UPDATE job_applications SET reviewed_at = NOW() WHERE application_id = $1`,
        [applicationId]
      );
    }

    res.status(200).json(
      successResponse({
        applicationId: app.application_id,
        jobId: app.job_id,
        jobTitle: app.job_title,
        candidate: {
          userId: app.user_id,
          firstName: app.first_name,
          lastName: app.last_name,
          email: app.email,
          profile: {
            profileId: app.profile_id,
            headline: app.headline,
            summary: app.summary,
            yearsOfExperience: app.years_experience,
            city: app.city,
            state: app.state,
            remotePreference: app.remote_preference,
          },
        },
        coverLetter: app.cover_letter,
        resumeUrl: app.resume_url,
        customResponses: app.custom_responses,
        status: app.status,
        appliedAt: app.applied_at,
        reviewedAt: app.reviewed_at || new Date(),
        updatedAt: app.updated_at,
        // Match data if exists
        matchScore: app.overall_score ? parseFloat(app.overall_score) : null,
        matchRank: app.match_rank,
        skillBreakdown: app.skill_breakdown,
      })
    );
  } catch (error: any) {
    console.error('Get application details error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching application details')
    );
  }
}

/**
 * Update application status (Employer only)
 */
export async function updateApplicationStatus(req: Request, res: Response): Promise<void> {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.user_id;

    // Validate status
    const validStatuses = ['submitted', 'under_review', 'interviewing', 'rejected', 'withdrawn', 'accepted'];
    if (!validStatuses.includes(status)) {
      res.status(400).json(
        errorResponse('INVALID_STATUS', `Status must be one of: ${validStatuses.join(', ')}`)
      );
      return;
    }

    // Verify application exists and employer has permission
    const appCheck = await query(
      `SELECT ja.application_id, ja.job_id
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.job_id
       JOIN company_users cu ON j.company_id = cu.company_id
       WHERE ja.application_id = $1 AND cu.user_id = $2`,
      [applicationId, userId]
    );

    if (appCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('APPLICATION_NOT_FOUND', 'Application not found or you do not have permission')
      );
      return;
    }

    // Update application status
    const result = await query(
      `UPDATE job_applications
       SET status = $1, updated_at = NOW()
       WHERE application_id = $2
       RETURNING application_id, status, updated_at`,
      [status, applicationId]
    );

    res.status(200).json(
      successResponse({
        applicationId: result.rows[0].application_id,
        status: result.rows[0].status,
        updatedAt: result.rows[0].updated_at,
      })
    );
  } catch (error: any) {
    console.error('Update application status error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating application status')
    );
  }
}
