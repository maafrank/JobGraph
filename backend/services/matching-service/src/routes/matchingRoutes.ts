import { Router } from 'express';
import {
  calculateJobMatches,
  getJobCandidates,
  getCandidateMatches,
  browseJobsWithScores,
  updateMatchStatus,
  contactCandidate,
  getApplicationDetails,
  updateApplicationStatus,
} from '../controllers/matchingController';
import { authenticate, requireRole } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/matching/jobs/:jobId/calculate
 * @desc    Calculate matches for a job (find and rank candidates)
 * @access  Private (Employer only)
 */
router.post('/jobs/:jobId/calculate', requireRole('employer'), calculateJobMatches);

/**
 * @route   GET /api/v1/matching/jobs/:jobId/candidates
 * @desc    Get ranked candidate matches for a job
 * @access  Private (Employer only)
 */
router.get('/jobs/:jobId/candidates', requireRole('employer'), getJobCandidates);

/**
 * @route   GET /api/v1/matching/candidate/matches
 * @desc    Get job matches for the authenticated candidate (stored matches only)
 * @access  Private (Candidate only)
 */
router.get('/candidate/matches', requireRole('candidate'), getCandidateMatches);

/**
 * @route   GET /api/v1/matching/candidate/browse-jobs
 * @desc    Browse ALL jobs with calculated match scores (including partial matches)
 * @access  Private (Candidate only)
 */
router.get('/candidate/browse-jobs', requireRole('candidate'), browseJobsWithScores);

/**
 * @route   PUT /api/v1/matching/matches/:matchId/status
 * @desc    Update match status (matched, contacted, interviewing, offered, rejected, hired)
 * @access  Private (Employer only)
 */
router.put('/matches/:matchId/status', requireRole('employer'), updateMatchStatus);

/**
 * @route   POST /api/v1/matching/matches/:matchId/contact
 * @desc    Contact a candidate (marks as contacted, sends notification)
 * @access  Private (Employer only)
 */
router.post('/matches/:matchId/contact', requireRole('employer'), contactCandidate);

/**
 * @route   GET /api/v1/matching/applications/:applicationId
 * @desc    Get application details (employer view - includes cover letter)
 * @access  Private (Employer only)
 */
router.get('/applications/:applicationId', requireRole('employer'), getApplicationDetails);

/**
 * @route   PUT /api/v1/matching/applications/:applicationId/status
 * @desc    Update application status (employer only)
 * @access  Private (Employer only)
 */
router.put('/applications/:applicationId/status', requireRole('employer'), updateApplicationStatus);

export default router;
