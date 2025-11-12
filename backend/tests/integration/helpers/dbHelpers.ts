import { query } from '@jobgraph/common';

/**
 * Clean up test data from database
 * Removes all users, refresh tokens, and related data
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    // Delete in order to respect foreign key constraints
    await query('DELETE FROM refresh_tokens', []);
    await query('DELETE FROM company_users', []);
    await query('DELETE FROM companies WHERE name LIKE $1', ['Test Company%']);
    await query('DELETE FROM candidate_profiles WHERE user_id IN (SELECT user_id FROM users WHERE email LIKE $1)', ['test%@test.com']);
    await query('DELETE FROM users WHERE email LIKE $1', ['test%@test.com']);
  } catch (error) {
    console.error('Error cleaning up database:', error);
    throw error;
  }
}

/**
 * Create a test user directly in the database
 * Useful for setting up test scenarios
 */
export async function createTestUser(userData: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiresAt?: Date;
}): Promise<any> {
  const result = await query(
    `INSERT INTO users (
      email,
      password_hash,
      first_name,
      last_name,
      role,
      email_verified,
      email_verification_token,
      email_verification_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING user_id, email, first_name, last_name, role, email_verified, created_at`,
    [
      userData.email,
      userData.passwordHash,
      userData.firstName,
      userData.lastName,
      userData.role,
      userData.emailVerified || false,
      userData.emailVerificationToken || null,
      userData.emailVerificationExpiresAt || null,
    ]
  );

  return result.rows[0];
}

/**
 * Create a refresh token directly in the database
 */
export async function createTestRefreshToken(tokenData: {
  userId: string;
  token: string;
  expiresAt: Date;
  revoked?: boolean;
}): Promise<any> {
  const result = await query(
    `INSERT INTO refresh_tokens (
      user_id,
      token,
      expires_at,
      revoked,
      user_agent,
      ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING token_id, user_id, token, expires_at, revoked`,
    [
      tokenData.userId,
      tokenData.token,
      tokenData.expiresAt,
      tokenData.revoked || false,
      'test-agent',
      '127.0.0.1',
    ]
  );

  return result.rows[0];
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<any> {
  const result = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0];
}

/**
 * Get refresh token by token string
 */
export async function getRefreshTokenByToken(token: string): Promise<any> {
  const result = await query(
    'SELECT * FROM refresh_tokens WHERE token = $1',
    [token]
  );

  return result.rows[0];
}

/**
 * Check if candidate profile exists for user
 */
export async function candidateProfileExists(userId: string): Promise<boolean> {
  const result = await query(
    'SELECT profile_id FROM candidate_profiles WHERE user_id = $1',
    [userId]
  );

  return result.rows.length > 0;
}

/**
 * Check if company exists and user is linked to it
 */
export async function getCompanyForUser(userId: string): Promise<any> {
  const result = await query(
    `SELECT c.*, cu.role as user_role
     FROM companies c
     JOIN company_users cu ON c.company_id = cu.company_id
     WHERE cu.user_id = $1`,
    [userId]
  );

  return result.rows[0];
}
