import { Request, Response } from 'express';
import { query } from '@jobgraph/common';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  getRefreshTokenExpiryDate,
  generateVerificationToken,
  getVerificationTokenExpiryDate,
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

    // Generate JWT access token
    const accessToken = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    // Generate refresh token
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiryDate();

    // Get user agent and IP for security tracking
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Store refresh token in database
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, refreshToken, expiresAt, userAgent, ipAddress]
    );

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
        accessToken,
        refreshToken,
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

    // Generate JWT access token (short-lived)
    const accessToken = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    // Generate refresh token (long-lived)
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiryDate();

    // Get user agent and IP for security tracking
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Store refresh token in database
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, refreshToken, expiresAt, userAgent, ipAddress]
    );

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
        accessToken: accessToken,
        refreshToken: refreshToken,
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

/**
 * Refresh access token using refresh token
 * POST /api/v1/auth/refresh
 */
export async function refreshAccessToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Refresh token is required')
      );
      return;
    }

    // Find refresh token in database
    const tokenResult = await query(
      `SELECT rt.token_id, rt.user_id, rt.expires_at, rt.revoked,
              u.email, u.role
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.user_id
       WHERE rt.token = $1`,
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      res.status(401).json(
        errorResponse('INVALID_TOKEN', 'Invalid refresh token')
      );
      return;
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is revoked
    if (tokenData.revoked) {
      res.status(401).json(
        errorResponse('TOKEN_REVOKED', 'Refresh token has been revoked')
      );
      return;
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json(
        errorResponse('TOKEN_EXPIRED', 'Refresh token has expired')
      );
      return;
    }

    // Generate new access token
    const accessToken = generateToken({
      user_id: tokenData.user_id,
      email: tokenData.email,
      role: tokenData.role,
    });

    // Generate new refresh token for rotation
    const newRefreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiryDate();
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Revoke old refresh token
    await query(
      `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW()
       WHERE token = $1`,
      [refreshToken]
    );

    // Store new refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenData.user_id, newRefreshToken, expiresAt, userAgent, ipAddress]
    );

    res.status(200).json(
      successResponse({
        accessToken: accessToken,
        refreshToken: newRefreshToken,
      })
    );
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred refreshing the token')
    );
  }
}

/**
 * Logout user (revoke refresh token)
 * POST /api/v1/auth/logout
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Refresh token is required')
      );
      return;
    }

    // Revoke the refresh token
    const result = await query(
      `UPDATE refresh_tokens
       SET revoked = TRUE, revoked_at = NOW()
       WHERE token = $1 AND revoked = FALSE
       RETURNING token_id`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      // Token either doesn't exist or was already revoked
      // We'll still return success for security
      res.status(200).json(
        successResponse({
          message: 'Logged out successfully',
        })
      );
      return;
    }

    res.status(200).json(
      successResponse({
        message: 'Logged out successfully',
      })
    );
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred during logout')
    );
  }
}

/**
 * Verify email address
 * POST /api/v1/auth/verify-email
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Verification token is required')
      );
      return;
    }

    // Find user with this verification token
    const result = await query(
      `SELECT user_id, email, email_verification_expires_at
       FROM users
       WHERE email_verification_token = $1 AND email_verified = FALSE`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json(
        errorResponse('INVALID_TOKEN', 'Invalid or expired verification token')
      );
      return;
    }

    const user = result.rows[0];

    // Check if token is expired
    if (new Date(user.email_verification_expires_at) < new Date()) {
      res.status(400).json(
        errorResponse('TOKEN_EXPIRED', 'Verification token has expired')
      );
      return;
    }

    // Mark email as verified
    await query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires_at = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    res.status(200).json(
      successResponse({
        message: 'Email verified successfully',
        email: user.email,
      })
    );
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred during email verification')
    );
  }
}
