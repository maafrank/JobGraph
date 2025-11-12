import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from './helpers/testApp';
import {
  cleanupDatabase,
  createTestUser,
  createTestRefreshToken,
  getUserByEmail,
  getRefreshTokenByToken,
  candidateProfileExists,
  getCompanyForUser,
} from './helpers/dbHelpers';
import { hashPassword, generateToken } from '@jobgraph/common';

describe('Auth Service Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await cleanupDatabase();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupDatabase();
  });

  // ===========================
  // REGISTRATION TESTS
  // ===========================

  describe('POST /api/v1/auth/register', () => {
    it('should register a new candidate successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testcandidate@test.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'Candidate',
          role: 'candidate',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe('testcandidate@test.com');
      expect(response.body.data.user.role).toBe('candidate');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // Verify user was created in database
      const user = await getUserByEmail('testcandidate@test.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('testcandidate@test.com');

      // Verify candidate profile was auto-created
      const hasProfile = await candidateProfileExists(user.user_id);
      expect(hasProfile).toBe(true);
    });

    it('should register a new employer with company successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testemployer@test.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'Employer',
          role: 'employer',
          companyName: 'Test Company Inc',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('employer');

      // Verify user was created
      const user = await getUserByEmail('testemployer@test.com');
      expect(user).toBeDefined();

      // Verify company was created and user is linked as owner
      const company = await getCompanyForUser(user.user_id);
      expect(company).toBeDefined();
      expect(company.name).toBe('Test Company Inc');
      expect(company.user_role).toBe('owner');
    });

    it('should register candidate with optional social links', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testcandidate2@test.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'Candidate',
          role: 'candidate',
          phone: '+1234567890',
          linkedinUrl: 'https://linkedin.com/in/testuser',
          githubUrl: 'https://github.com/testuser',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify user was created with phone
      const user = await getUserByEmail('testcandidate2@test.com');
      expect(user.phone).toBe('+1234567890');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'candidate',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testuser@test.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          role: 'candidate',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'candidate',
        });

      // Second registration with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'Test123!',
          firstName: 'Another',
          lastName: 'User',
          role: 'candidate',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject employer registration without company name', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'employer@test.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'Employer',
          role: 'employer',
          // Missing companyName
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@test.com',
          // Missing password, firstName, lastName, role
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with invalid role', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@test.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'invalid_role',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ROLE');
    });
  });

  // ===========================
  // LOGIN TESTS
  // ===========================

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      const passwordHash = await hashPassword('Test123!');
      await createTestUser({
        email: 'testlogin@test.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Login',
        role: 'candidate',
        emailVerified: true,
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testlogin@test.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('testlogin@test.com');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // Verify refresh token was stored in database
      const storedToken = await getRefreshTokenByToken(response.body.data.refreshToken);
      expect(storedToken).toBeDefined();
      expect(storedToken.revoked).toBe(false);
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testlogin@test.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testlogin@test.com',
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================
  // PROTECTED ROUTE TESTS
  // ===========================

  describe('GET /api/v1/auth/me', () => {
    let testUser: any;
    let validToken: string;

    beforeEach(async () => {
      // Create test user
      const passwordHash = await hashPassword('Test123!');
      testUser = await createTestUser({
        email: 'testme@test.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Me',
        role: 'candidate',
        emailVerified: true,
      });

      // Generate valid token
      validToken = generateToken({
        user_id: testUser.user_id,
        email: testUser.email,
        role: testUser.role,
      });
    });

    it('should return user data with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('testme@test.com');
      expect(response.body.data.firstName).toBe('Test');
      expect(response.body.data.lastName).toBe('Me');
      expect(response.body.data.role).toBe('candidate');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  // ===========================
  // TOKEN REFRESH TESTS
  // ===========================

  describe('POST /api/v1/auth/refresh', () => {
    let testUser: any;
    let validRefreshToken: string;

    beforeEach(async () => {
      // Create test user
      const passwordHash = await hashPassword('Test123!');
      testUser = await createTestUser({
        email: 'testrefresh@test.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Refresh',
        role: 'candidate',
        emailVerified: true,
      });

      // Create valid refresh token
      validRefreshToken = 'test_refresh_token_' + Date.now();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      await createTestRefreshToken({
        userId: testUser.user_id,
        token: validRefreshToken,
        expiresAt,
        revoked: false,
      });
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: validRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      // New refresh token should be different
      expect(response.body.data.refreshToken).not.toBe(validRefreshToken);

      // Old refresh token should be revoked
      const oldToken = await getRefreshTokenByToken(validRefreshToken);
      expect(oldToken.revoked).toBe(true);

      // New refresh token should be stored
      const newToken = await getRefreshTokenByToken(response.body.data.refreshToken);
      expect(newToken).toBeDefined();
      expect(newToken.revoked).toBe(false);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid_token',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject revoked refresh token', async () => {
      // Create revoked token
      const revokedToken = 'revoked_token_' + Date.now();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await createTestRefreshToken({
        userId: testUser.user_id,
        token: revokedToken,
        expiresAt,
        revoked: true,
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: revokedToken,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_REVOKED');
    });

    it('should reject expired refresh token', async () => {
      // Create expired token
      const expiredToken = 'expired_token_' + Date.now();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // 1 day ago

      await createTestRefreshToken({
        userId: testUser.user_id,
        token: expiredToken,
        expiresAt,
        revoked: false,
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: expiredToken,
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject request without refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================
  // LOGOUT TESTS
  // ===========================

  describe('POST /api/v1/auth/logout', () => {
    let testUser: any;
    let validRefreshToken: string;

    beforeEach(async () => {
      // Create test user
      const passwordHash = await hashPassword('Test123!');
      testUser = await createTestUser({
        email: 'testlogout@test.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Logout',
        role: 'candidate',
        emailVerified: true,
      });

      // Create refresh token
      validRefreshToken = 'logout_test_token_' + Date.now();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await createTestRefreshToken({
        userId: testUser.user_id,
        token: validRefreshToken,
        expiresAt,
        revoked: false,
      });
    });

    it('should logout successfully and revoke refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: validRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Logged out successfully');

      // Verify token was revoked
      const token = await getRefreshTokenByToken(validRefreshToken);
      expect(token.revoked).toBe(true);
    });

    it('should handle logout with already revoked or invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: 'invalid_or_revoked_token',
        });

      // Should still return success for security reasons
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject logout request without refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================
  // EMAIL VERIFICATION TESTS
  // ===========================

  describe('POST /api/v1/auth/verify-email', () => {
    let testUser: any;
    const validVerificationToken = 'valid_verification_token_123';

    beforeEach(async () => {
      // Create test user with verification token
      const passwordHash = await hashPassword('Test123!');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

      testUser = await createTestUser({
        email: 'testverify@test.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Verify',
        role: 'candidate',
        emailVerified: false,
        emailVerificationToken: validVerificationToken,
        emailVerificationExpiresAt: expiresAt,
      });
    });

    it('should verify email with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({
          token: validVerificationToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Email verified successfully');
      expect(response.body.data.email).toBe('testverify@test.com');

      // Verify user's email_verified flag was updated
      const user = await getUserByEmail('testverify@test.com');
      expect(user.email_verified).toBe(true);
      expect(user.email_verification_token).toBeNull();
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({
          token: 'invalid_token',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired verification token', async () => {
      // Create user with expired token
      const passwordHash = await hashPassword('Test123!');
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour ago

      const expiredUser = await createTestUser({
        email: 'testexpired@test.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'Expired',
        role: 'candidate',
        emailVerified: false,
        emailVerificationToken: 'expired_token',
        emailVerificationExpiresAt: expiredDate,
      });

      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({
          token: 'expired_token',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject verification request without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
