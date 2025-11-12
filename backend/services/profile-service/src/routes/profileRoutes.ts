import { Router } from 'express';
import {
  getCandidateProfile,
  updateCandidateProfile,
  addEducation,
  updateEducation,
  deleteEducation,
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  getCandidateSkills,
  addCandidateSkill,
  updateCandidateSkill,
  deleteCandidateSkill,
  addProfessionalLink,
  updateProfessionalLink,
  deleteProfessionalLink,
} from '../controllers/profileController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/profiles/candidate
 * @desc    Get candidate profile with education and work experience
 * @access  Private (Candidate only)
 */
router.get('/candidate', getCandidateProfile);

/**
 * @route   PUT /api/v1/profiles/candidate
 * @desc    Update candidate profile
 * @access  Private (Candidate only)
 */
router.put('/candidate', updateCandidateProfile);

/**
 * @route   POST /api/v1/profiles/candidate/education
 * @desc    Add education to profile
 * @access  Private (Candidate only)
 */
router.post('/candidate/education', addEducation);

/**
 * @route   PUT /api/v1/profiles/candidate/education/:educationId
 * @desc    Update education
 * @access  Private (Candidate only)
 */
router.put('/candidate/education/:educationId', updateEducation);

/**
 * @route   DELETE /api/v1/profiles/candidate/education/:educationId
 * @desc    Delete education
 * @access  Private (Candidate only)
 */
router.delete('/candidate/education/:educationId', deleteEducation);

/**
 * @route   POST /api/v1/profiles/candidate/experience
 * @desc    Add work experience to profile
 * @access  Private (Candidate only)
 */
router.post('/candidate/experience', addWorkExperience);

/**
 * @route   PUT /api/v1/profiles/candidate/experience/:experienceId
 * @desc    Update work experience
 * @access  Private (Candidate only)
 */
router.put('/candidate/experience/:experienceId', updateWorkExperience);

/**
 * @route   DELETE /api/v1/profiles/candidate/experience/:experienceId
 * @desc    Delete work experience
 * @access  Private (Candidate only)
 */
router.delete('/candidate/experience/:experienceId', deleteWorkExperience);

/**
 * @route   GET /api/v1/profiles/candidate/skills
 * @desc    Get candidate's skill scores
 * @access  Private (Candidate only)
 */
router.get('/candidate/skills', getCandidateSkills);

/**
 * @route   POST /api/v1/profiles/candidate/skills
 * @desc    Add manual skill score (MVP - no interview)
 * @access  Private (Candidate only)
 */
router.post('/candidate/skills', addCandidateSkill);

/**
 * @route   PUT /api/v1/profiles/candidate/skills/:skillId
 * @desc    Update skill score
 * @access  Private (Candidate only)
 */
router.put('/candidate/skills/:skillId', updateCandidateSkill);

/**
 * @route   DELETE /api/v1/profiles/candidate/skills/:skillId
 * @desc    Delete skill from profile
 * @access  Private (Candidate only)
 */
router.delete('/candidate/skills/:skillId', deleteCandidateSkill);

/**
 * @route   POST /api/v1/profiles/candidate/links
 * @desc    Add professional link to profile
 * @access  Private (Candidate only)
 */
router.post('/candidate/links', addProfessionalLink);

/**
 * @route   PUT /api/v1/profiles/candidate/links/:linkId
 * @desc    Update professional link
 * @access  Private (Candidate only)
 */
router.put('/candidate/links/:linkId', updateProfessionalLink);

/**
 * @route   DELETE /api/v1/profiles/candidate/links/:linkId
 * @desc    Delete professional link
 * @access  Private (Candidate only)
 */
router.delete('/candidate/links/:linkId', deleteProfessionalLink);

export default router;
