import { Router } from 'express';
import { register, login, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

export default router;
