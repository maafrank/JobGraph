import { Request, Response } from 'express';
import { query } from '@jobgraph/common';
import {
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isValidPassword,
  successResponse,
  errorResponse,
  AppError,
} from '@jobgraph/common';

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Missing required fields', {
          required: ['email', 'password', 'firstName', 'lastName', 'role'],
        })
      );
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      res.status(400).json(
        errorResponse('INVALID_EMAIL', 'Invalid email format')
      );
      return;
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      res.status(400).json(
        errorResponse(
          'WEAK_PASSWORD',
          'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        )
      );
      return;
    }

    // Validate role
    const validRoles = ['candidate', 'employer', 'admin'];
    if (!validRoles.includes(role)) {
      res.status(400).json(
        errorResponse('INVALID_ROLE', 'Role must be candidate, employer, or admin')
      );
      return;
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT user_id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json(
        errorResponse('USER_EXISTS', 'User with this email already exists')
      );
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role, false]
    );

    const user = result.rows[0];

    // Auto-create candidate profile if role is candidate
    if (role === 'candidate') {
      await query(
        'INSERT INTO candidate_profiles (user_id) VALUES ($1)',
        [user.user_id]
      );
    }

    // Generate JWT token
    const token = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json(
      successResponse({
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          emailVerified: false,
          createdAt: user.created_at,
        },
        token,
      })
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred during registration')
    );
  }
}

/**
 * Login user
 * POST /api/v1/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Email and password are required')
      );
      return;
    }

    // Find user by email
    const result = await query(
      'SELECT user_id, email, password_hash, first_name, last_name, role, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json(
        errorResponse('INVALID_CREDENTIALS', 'Invalid email or password')
      );
      return;
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json(
        errorResponse('INVALID_CREDENTIALS', 'Invalid email or password')
      );
      return;
    }

    // Generate JWT token
    const token = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    res.status(200).json(
      successResponse({
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          emailVerified: user.email_verified,
        },
        token,
      })
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred during login')
    );
  }
}

/**
 * Get current user info
 * GET /api/v1/auth/me
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    // User ID is attached by auth middleware
    const userId = (req as any).user.user_id;

    const result = await query(
      'SELECT user_id, email, first_name, last_name, role, email_verified, created_at FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('USER_NOT_FOUND', 'User not found')
      );
      return;
    }

    const user = result.rows[0];

    res.status(200).json(
      successResponse({
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
      })
    );
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching user data')
    );
  }
}
