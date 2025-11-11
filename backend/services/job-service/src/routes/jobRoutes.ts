import { Router } from 'express';
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  addJobSkill,
  updateJobSkill,
  deleteJobSkill,
} from '../controllers/jobController';
import { authenticate, requireRole } from '../middleware/authMiddleware';

const router = Router();

/**
 * @route   GET /api/v1/jobs
 * @desc    Get all jobs with optional filters
 * @access  Public
 */
router.get('/', getJobs);

/**
 * @route   GET /api/v1/jobs/:jobId
 * @desc    Get a single job by ID
 * @access  Public
 */
router.get('/:jobId', getJobById);

/**
 * @route   POST /api/v1/jobs
 * @desc    Create a new job posting
 * @access  Private (Employer only)
 */
router.post('/', authenticate, requireRole('employer'), createJob);

/**
 * @route   PUT /api/v1/jobs/:jobId
 * @desc    Update a job
 * @access  Private (Employer only, must own job)
 */
router.put('/:jobId', authenticate, requireRole('employer'), updateJob);

/**
 * @route   DELETE /api/v1/jobs/:jobId
 * @desc    Cancel/close a job
 * @access  Private (Employer only, must own job)
 */
router.delete('/:jobId', authenticate, requireRole('employer'), deleteJob);

/**
 * @route   POST /api/v1/jobs/:jobId/skills
 * @desc    Add a required skill to a job
 * @access  Private (Employer only, must own job)
 */
router.post('/:jobId/skills', authenticate, requireRole('employer'), addJobSkill);

/**
 * @route   PUT /api/v1/jobs/:jobId/skills/:skillId
 * @desc    Update a job skill requirement
 * @access  Private (Employer only, must own job)
 */
router.put('/:jobId/skills/:skillId', authenticate, requireRole('employer'), updateJobSkill);

/**
 * @route   DELETE /api/v1/jobs/:jobId/skills/:skillId
 * @desc    Remove a skill from a job
 * @access  Private (Employer only, must own job)
 */
router.delete('/:jobId/skills/:skillId', authenticate, requireRole('employer'), deleteJobSkill);

export default router;
