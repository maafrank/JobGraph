import { Router } from 'express';
import {
  createCompany,
  getCompany,
  getMyCompany,
  updateCompany,
  listCompanies,
} from '../controllers/companyController';
import { authenticate, requireRole } from '../middleware/authMiddleware';

const router = Router();

/**
 * @route   GET /api/v1/profiles/companies
 * @desc    List all companies (with optional filters)
 * @access  Public
 */
router.get('/companies', listCompanies);

/**
 * @route   GET /api/v1/profiles/companies/:companyId
 * @desc    Get company profile by ID
 * @access  Public
 */
router.get('/companies/:companyId', getCompany);

/**
 * @route   POST /api/v1/profiles/company
 * @desc    Create a new company profile
 * @access  Private (Employer only)
 */
router.post('/company', authenticate, requireRole('employer'), createCompany);

/**
 * @route   GET /api/v1/profiles/company
 * @desc    Get the authenticated user's company
 * @access  Private (Employer only)
 */
router.get('/company', authenticate, requireRole('employer'), getMyCompany);

/**
 * @route   PUT /api/v1/profiles/company
 * @desc    Update the user's company profile
 * @access  Private (Employer - owner/admin only)
 */
router.put('/company', authenticate, requireRole('employer'), updateCompany);

export default router;
