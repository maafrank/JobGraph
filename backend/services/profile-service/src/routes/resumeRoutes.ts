import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authMiddleware';
import {
  uploadResume,
  getCurrentResume,
  downloadResume,
  deleteResume,
  getParsedData,
  getSuggestions,
  applySuggestion,
  rejectSuggestion
} from '../controllers/resumeController';

const router = express.Router();

// Configure multer for memory storage (stores file in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// All resume routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/profiles/candidate/resume/upload
 * @desc    Upload resume (PDF, DOCX, or TXT)
 * @access  Private (Candidate only)
 */
router.post('/upload', upload.single('resume'), uploadResume);

/**
 * @route   GET /api/v1/profiles/candidate/resume
 * @desc    Get current resume metadata
 * @access  Private (Candidate only)
 */
router.get('/', getCurrentResume);

/**
 * @route   GET /api/v1/profiles/candidate/resume/download
 * @desc    Download current resume file
 * @access  Private (Candidate only)
 */
router.get('/download', downloadResume);

/**
 * @route   GET /api/v1/profiles/candidate/resume/parsed
 * @desc    Get parsed resume data
 * @access  Private (Candidate only)
 */
router.get('/parsed', getParsedData);

/**
 * @route   GET /api/v1/profiles/candidate/resume/suggestions
 * @desc    Get auto-fill suggestions from parsed resume
 * @access  Private (Candidate only)
 */
router.get('/suggestions', getSuggestions);

/**
 * @route   POST /api/v1/profiles/candidate/resume/suggestions/:suggestionId/apply
 * @desc    Apply a suggestion to profile
 * @access  Private (Candidate only)
 */
router.post('/suggestions/:suggestionId/apply', applySuggestion);

/**
 * @route   DELETE /api/v1/profiles/candidate/resume/suggestions/:suggestionId
 * @desc    Reject a suggestion
 * @access  Private (Candidate only)
 */
router.delete('/suggestions/:suggestionId', rejectSuggestion);

/**
 * @route   DELETE /api/v1/profiles/candidate/resume/:documentId
 * @desc    Delete resume
 * @access  Private (Candidate only)
 */
router.delete('/:documentId', deleteResume);

export default router;
