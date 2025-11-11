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

    // Get matches for this job
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
         cp.profile_id,
         cp.headline,
         cp.years_experience,
         cp.city,
         cp.state,
         cp.willing_to_relocate,
         cp.remote_preference
       FROM job_matches jm
       JOIN users u ON jm.user_id = u.user_id
       JOIN candidate_profiles cp ON u.user_id = cp.user_id
       WHERE jm.job_id = $1
       ORDER BY jm.match_rank ASC`,
      [jobId]
    );

    const matches = matchesResult.rows.map(match => ({
      matchId: match.match_id,
      userId: match.user_id,
      email: match.email,
      profileId: match.profile_id,
      headline: match.headline,
      yearsExperience: match.years_experience,
      location: {
        city: match.city,
        state: match.state,
      },
      willingToRelocate: match.willing_to_relocate,
      remotePreference: match.remote_preference,
      overallScore: parseFloat(match.overall_score),
      rank: match.match_rank,
      skillBreakdown: match.skill_breakdown,
      status: match.status,
      contactedAt: match.contacted_at,
      matchedAt: match.created_at,
    }));

    res.status(200).json(
      successResponse({
        jobId: jobId,
        jobTitle: jobCheck.rows[0].title,
        totalMatches: matches.length,
        matches: matches,
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
