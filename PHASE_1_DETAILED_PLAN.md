# Phase 1: MVP - Core Infrastructure - Detailed Implementation Plan

**Timeline**: Week 3-11 (9 weeks)
**Goal**: Working MVP with authentication, profiles, resume upload, job posting, and basic matching

---

## Week 3: Authentication Service (1.1)

### Day 1-2: Auth Service Structure & Registration

**Create Auth Service Structure**:
```bash
cd backend/services/auth-service/src

# Create directory structure
mkdir -p controllers
mkdir -p routes
mkdir -p services
mkdir -p validators
```

**Create Main Server File** (`src/index.ts`):
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { testDatabaseConnection, testRedisConnection } from '@jobgraph/common/database';
import authRoutes from './routes/auth.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Routes
app.use('/api/v1/auth', authRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

// Start server
async function start() {
  await testDatabaseConnection();
  await testRedisConnection();

  app.listen(PORT, () => {
    console.log(`🚀 Auth service running on port ${PORT}`);
  });
}

start();
```

**Create Auth Validators** (`src/validators/auth.validator.ts`):
```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[@$!%*?&#]/, 'Password must contain special character'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['candidate', 'employer']),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

**Create Auth Service** (`src/services/auth.service.ts`):
```typescript
import { pool, redis } from '@jobgraph/common/database';
import { hashPassword, comparePassword, generateToken } from '@jobgraph/common/utils';
import { AppError } from '@jobgraph/common/utils';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { randomBytes } from 'crypto';

export class AuthService {
  async register(data: RegisterInput) {
    const { email, password, firstName, lastName, role, phone } = data;

    // Check if user exists
    const existingUser = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new AppError(409, 'USER_EXISTS', 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, role, phone]
    );

    const user = result.rows[0];

    // Create profile based on role
    if (role === 'candidate') {
      await pool.query(
        'INSERT INTO candidate_profiles (user_id) VALUES ($1)',
        [user.user_id]
      );
    }

    // Generate tokens
    const accessToken = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = randomBytes(32).toString('hex');

    // Store refresh token in Redis (30 days expiry)
    await redis.setex(
      `refresh_token:${user.user_id}`,
      30 * 24 * 60 * 60,
      refreshToken
    );

    return {
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginInput) {
    const { email, password } = data;

    // Find user
    const result = await pool.query(
      `SELECT user_id, email, password_hash, first_name, last_name, role, active, email_verified
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const user = result.rows[0];

    if (!user.active) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account has been disabled');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = randomBytes(32).toString('hex');
    await redis.setex(
      `refresh_token:${user.user_id}`,
      30 * 24 * 60 * 60,
      refreshToken
    );

    return {
      user: {
        id: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        emailVerified: user.email_verified,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    // Verify refresh token
    const storedToken = await redis.get(`refresh_token:${userId}`);

    if (!storedToken || storedToken !== refreshToken) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
    }

    // Get user
    const result = await pool.query(
      'SELECT user_id, email, role FROM users WHERE user_id = $1 AND active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found');
    }

    const user = result.rows[0];

    // Generate new access token
    const accessToken = generateToken({
      user_id: user.user_id,
      email: user.email,
      role: user.role,
    });

    return { accessToken };
  }

  async logout(userId: string) {
    await redis.del(`refresh_token:${userId}`);
  }
}
```

**Create Auth Controller** (`src/controllers/auth.controller.ts`):
```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { registerSchema, loginSchema } from '../validators/auth.validator';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate input
      const data = registerSchema.parse(req.body);

      // Register user
      const result = await authService.register(data);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const { user_id } = req.user; // From auth middleware

      const result = await authService.refreshToken(user_id, refreshToken);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { user_id } = req.user;
      await authService.logout(user_id);

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: { user: req.user },
      });
    } catch (error) {
      next(error);
    }
  }
}
```

**Create Auth Routes** (`src/routes/auth.routes.ts`):
```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '@jobgraph/common/middleware/auth';

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [candidate, employer]
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register', (req, res, next) => authController.register(req, res, next));

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/refresh-token', authMiddleware, (req, res, next) => authController.refreshToken(req, res, next));
router.post('/logout', authMiddleware, (req, res, next) => authController.logout(req, res, next));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

export default router;
```

### Day 3: Auth Middleware & Testing

**Create Auth Middleware** (`backend/common/src/middleware/auth.ts`):
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken, AppError } from '../utils';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'No token provided');
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    req.user = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Token has expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError(401, 'INVALID_TOKEN', 'Invalid token'));
    }
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
    }

    next();
  };
}
```

**Create Auth Tests** (`backend/tests/integration/auth.test.ts`):
```typescript
import request from 'supertest';
import { pool } from '../../common/src/database';

const API_URL = 'http://localhost:3001';

describe('Auth API', () => {
  beforeAll(async () => {
    // Clean up test data
    await pool.query("DELETE FROM users WHERE email LIKE '%test.auth%'");
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new candidate', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'candidate.test.auth@example.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'Candidate',
          role: 'candidate',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('candidate.test.auth@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'candidate.test.auth@example.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'Candidate',
          role: 'candidate',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject weak password', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'weak.test.auth@example.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          role: 'candidate',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'candidate.test.auth@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'candidate.test.auth@example.com',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const response = await request(API_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'candidate.test.auth@example.com',
          password: 'Test123!',
        });
      token = response.body.data.accessToken;
    });

    it('should return current user', async () => {
      const response = await request(API_URL)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe('candidate.test.auth@example.com');
    });

    it('should reject request without token', async () => {
      const response = await request(API_URL).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
```

**Run Tests**:
```bash
# Start auth service
cd backend/services/auth-service
npm run dev

# In another terminal, run tests
cd backend
npm test -- auth.test.ts
```

---

## Week 4: Profile Service (1.2)

### Day 1-2: Candidate Profiles

**Profile Service Structure** (`backend/services/profile-service/src`):
```
services/profile-service/
├── src/
│   ├── index.ts
│   ├── controllers/
│   │   ├── candidate-profile.controller.ts
│   │   └── company-profile.controller.ts
│   ├── services/
│   │   ├── candidate-profile.service.ts
│   │   └── company-profile.service.ts
│   ├── routes/
│   │   ├── candidate.routes.ts
│   │   └── company.routes.ts
│   └── validators/
│       └── profile.validator.ts
└── package.json
```

**Candidate Profile Service** (`src/services/candidate-profile.service.ts`):
```typescript
import { pool } from '@jobgraph/common/database';
import { AppError } from '@jobgraph/common/utils';
import { transaction } from '@jobgraph/common/database';

export class CandidateProfileService {
  async getProfile(userId: string) {
    const result = await pool.query(
      `SELECT cp.*,
              (SELECT json_agg(e.*) FROM education e WHERE e.profile_id = cp.profile_id) as education,
              (SELECT json_agg(we.*) FROM work_experience we WHERE we.profile_id = cp.profile_id) as work_experience
       FROM candidate_profiles cp
       WHERE cp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    return result.rows[0];
  }

  async updateProfile(userId: string, data: any) {
    const {
      headline,
      summary,
      yearsExperience,
      city,
      state,
      country,
      willingToRelocate,
      remotePreference,
      profileVisibility,
    } = data;

    const result = await pool.query(
      `UPDATE candidate_profiles
       SET headline = COALESCE($2, headline),
           summary = COALESCE($3, summary),
           years_experience = COALESCE($4, years_experience),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           country = COALESCE($7, country),
           willing_to_relocate = COALESCE($8, willing_to_relocate),
           remote_preference = COALESCE($9, remote_preference),
           profile_visibility = COALESCE($10, profile_visibility),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        headline,
        summary,
        yearsExperience,
        city,
        state,
        country,
        willingToRelocate,
        remotePreference,
        profileVisibility,
      ]
    );

    return result.rows[0];
  }

  async addEducation(userId: string, data: any) {
    const { degree, fieldOfStudy, institution, graduationYear, gpa } = data;

    // Get profile_id
    const profileResult = await pool.query(
      'SELECT profile_id FROM candidate_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const profileId = profileResult.rows[0].profile_id;

    const result = await pool.query(
      `INSERT INTO education (profile_id, degree, field_of_study, institution, graduation_year, gpa)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [profileId, degree, fieldOfStudy, institution, graduationYear, gpa]
    );

    return result.rows[0];
  }

  async deleteEducation(userId: string, educationId: string) {
    await pool.query(
      `DELETE FROM education e
       USING candidate_profiles cp
       WHERE e.profile_id = cp.profile_id
       AND cp.user_id = $1
       AND e.education_id = $2`,
      [userId, educationId]
    );
  }

  async addWorkExperience(userId: string, data: any) {
    const { title, company, startDate, endDate, isCurrent, description } = data;

    const profileResult = await pool.query(
      'SELECT profile_id FROM candidate_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }

    const profileId = profileResult.rows[0].profile_id;

    const result = await pool.query(
      `INSERT INTO work_experience (profile_id, title, company, start_date, end_date, is_current, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [profileId, title, company, startDate, endDate, isCurrent, description]
    );

    return result.rows[0];
  }

  async deleteWorkExperience(userId: string, experienceId: string) {
    await pool.query(
      `DELETE FROM work_experience we
       USING candidate_profiles cp
       WHERE we.profile_id = cp.profile_id
       AND cp.user_id = $1
       AND we.experience_id = $2`,
      [userId, experienceId]
    );
  }
}
```

**Create API Routes and Controllers** (similar pattern to auth service)

### Day 3-4: Company Profiles

Similar structure for company profile management.

---

## Week 5: File Upload & Resume Upload (1.3)

### Day 1-2: S3 Setup & Presigned URLs

**Install AWS SDK**:
```bash
cd backend/services/profile-service
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Create S3 Service** (`src/services/s3.service.ts`):
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_RESUMES || 'jobgraph-resumes-dev';

export class S3Service {
  async generateUploadUrl(userId: string, fileExtension: string) {
    const key = `resumes/${userId}/${randomBytes(16).toString('hex')}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileExtension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes

    return { uploadUrl, key };
  }

  async generateDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

    return downloadUrl;
  }
}
```

**Resume Controller**:
```typescript
async getResumeUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileExtension } = req.body;
    const userId = req.user.user_id;

    if (!['pdf', 'docx'].includes(fileExtension)) {
      throw new AppError(400, 'INVALID_FILE_TYPE', 'Only PDF and DOCX files are allowed');
    }

    const { uploadUrl, key } = await s3Service.generateUploadUrl(userId, fileExtension);

    res.json({
      success: true,
      data: { uploadUrl, key },
    });
  } catch (error) {
    next(error);
  }
}

async confirmResumeUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.body;
    const userId = req.user.user_id;

    // Update profile with resume URL
    await pool.query(
      `UPDATE candidate_profiles
       SET resume_url = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId, key]
    );

    // Trigger resume parsing (we'll implement this in next section)
    // await triggerResumeParsing(key);

    res.json({
      success: true,
      data: { message: 'Resume uploaded successfully' },
    });
  } catch (error) {
    next(error);
  }
}
```

### Day 3-5: Basic Resume Parsing

**Install PDF Parser**:
```bash
npm install pdf-parse
```

**Create Resume Parser** (`src/services/resume-parser.service.ts`):
```typescript
import pdfParse from 'pdf-parse';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { pool } from '@jobgraph/common/database';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export class ResumeParserService {
  async parseResume(key: string, userId: string) {
    try {
      // Download file from S3
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_RESUMES,
        Key: key,
      });

      const { Body } = await s3Client.send(command);
      const buffer = await this.streamToBuffer(Body as any);

      // Parse PDF
      const data = await pdfParse(buffer);
      const text = data.text;

      // Extract structured data
      const parsedData = this.extractDataFromText(text);

      // Store parsed data
      await pool.query(
        `UPDATE candidate_profiles
         SET resume_parsed_data = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId, JSON.stringify(parsedData)]
      );

      // Auto-fill profile fields if empty
      await this.autoFillProfile(userId, parsedData);

      // Generate follow-up questions
      await this.generateFollowUpQuestions(userId, parsedData);

      return parsedData;
    } catch (error) {
      console.error('Resume parsing error:', error);
      throw error;
    }
  }

  private extractDataFromText(text: string) {
    // Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;

    // Extract phone
    const phoneMatch = text.match(/(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : null;

    // Extract skills (simple keyword matching)
    const skillKeywords = ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Machine Learning'];
    const skills = skillKeywords.filter(skill =>
      text.toLowerCase().includes(skill.toLowerCase())
    );

    // Extract education (basic pattern matching)
    const educationSection = this.extractSection(text, ['education', 'academic']);

    // Extract work experience
    const workSection = this.extractSection(text, ['experience', 'work history', 'employment']);

    return {
      email,
      phone,
      skills,
      educationSection,
      workSection,
      rawText: text.substring(0, 5000), // First 5000 chars
    };
  }

  private extractSection(text: string, keywords: string[]) {
    // Simple section extraction logic
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        // Get next 500 characters after the keyword
        return text.substring(index, index + 500);
      }
    }

    return null;
  }

  private async autoFillProfile(userId: string, parsedData: any) {
    const updates: any = {};

    if (parsedData.skills && parsedData.skills.length > 0) {
      updates.headline = `Professional with skills in ${parsedData.skills.slice(0, 3).join(', ')}`;
    }

    if (Object.keys(updates).length > 0) {
      await pool.query(
        `UPDATE candidate_profiles
         SET headline = COALESCE(headline, $2),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND headline IS NULL`,
        [userId, updates.headline]
      );
    }
  }

  private async generateFollowUpQuestions(userId: string, parsedData: any) {
    const questions = [];

    // If no education section found
    if (!parsedData.educationSection) {
      questions.push({
        text: 'We couldn\'t find education information in your resume. Please provide your highest level of education.',
        type: 'education_missing',
      });
    }

    // If no work experience found
    if (!parsedData.workSection) {
      questions.push({
        text: 'We couldn\'t find work experience in your resume. Please describe your relevant work experience.',
        type: 'experience_missing',
      });
    }

    // Insert questions
    for (const question of questions) {
      await pool.query(
        `INSERT INTO follow_up_questions (user_id, question_text, question_type, triggered_by)
         VALUES ($1, $2, $3, $4)`,
        [userId, question.text, 'open_ended', question.type]
      );
    }
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
```

---

## Week 6: Skills Management (1.5)

**Skills API** (simple CRUD, already seeded in Phase 0):
```typescript
// GET /api/v1/skills - List all skills with pagination and filtering
// GET /api/v1/skills/:id - Get skill details
// POST /api/v1/skills - Admin only: Create new skill
// PUT /api/v1/skills/:id - Admin only: Update skill
```

---

## Week 7: Job Service (1.6)

**Job Service Implementation** - Similar structure to profile service:
- Create job (with required skills)
- List jobs (with filters)
- Get job details
- Update job
- Delete job
- Manage job skills (weights and minimum scores)

---

## Week 8: Basic Matching (1.7)

**Matching Service** (`backend/services/matching-service/src/services/matching.service.ts`):
```typescript
export class MatchingService {
  async calculateJobMatches(jobId: string) {
    // Get job with required skills
    const jobResult = await pool.query(
      `SELECT j.*,
              json_agg(json_build_object(
                'skill_id', js.skill_id,
                'weight', js.weight,
                'minimum_score', js.minimum_score,
                'required', js.required
              )) as required_skills
       FROM jobs j
       JOIN job_skills js ON j.job_id = js.job_id
       WHERE j.job_id = $1
       GROUP BY j.job_id`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }

    const job = jobResult.rows[0];
    const requiredSkills = job.required_skills;

    // Get all users who have ALL required skills
    const requiredSkillIds = requiredSkills
      .filter((s: any) => s.required)
      .map((s: any) => s.skill_id);

    const candidatesResult = await pool.query(
      `SELECT uss.user_id,
              json_agg(json_build_object(
                'skill_id', uss.skill_id,
                'score', uss.score
              )) as user_skills
       FROM user_skill_scores uss
       WHERE uss.skill_id = ANY($1)
       AND uss.expires_at > NOW()
       GROUP BY uss.user_id
       HAVING COUNT(DISTINCT uss.skill_id) = $2`,
      [requiredSkillIds, requiredSkillIds.length]
    );

    // Calculate match score for each candidate
    const matches = [];

    for (const candidate of candidatesResult.rows) {
      const matchScore = this.calculateMatchScore(
        candidate.user_skills,
        requiredSkills
      );

      if (matchScore.qualifies) {
        matches.push({
          userId: candidate.user_id,
          overallScore: matchScore.score,
          skillBreakdown: matchScore.breakdown,
        });
      }
    }

    // Sort by score
    matches.sort((a, b) => b.overallScore - a.overallScore);

    // Assign ranks
    matches.forEach((match, index) => {
      match.rank = index + 1;
    });

    // Store matches in database
    await this.storeMatches(jobId, matches);

    return matches;
  }

  private calculateMatchScore(userSkills: any[], requiredSkills: any[]) {
    let totalScore = 0;
    let totalWeight = 0;
    const breakdown = [];
    let qualifies = true;

    for (const required of requiredSkills) {
      const userSkill = userSkills.find(us => us.skill_id === required.skill_id);

      if (!userSkill) {
        qualifies = false;
        break;
      }

      // Check minimum threshold
      if (userSkill.score < required.minimum_score) {
        qualifies = false;
        break;
      }

      // Calculate weighted score
      totalScore += userSkill.score * required.weight;
      totalWeight += required.weight;

      breakdown.push({
        skillId: required.skill_id,
        userScore: userSkill.score,
        requiredScore: required.minimum_score,
        weight: required.weight,
      });
    }

    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      qualifies,
      score: Math.round(normalizedScore * 100) / 100,
      breakdown,
    };
  }

  private async storeMatches(jobId: string, matches: any[]) {
    // Delete existing matches
    await pool.query('DELETE FROM job_matches WHERE job_id = $1', [jobId]);

    // Insert new matches
    for (const match of matches) {
      await pool.query(
        `INSERT INTO job_matches (job_id, user_id, overall_score, match_rank, skill_breakdown, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          jobId,
          match.userId,
          match.overallScore,
          match.rank,
          JSON.stringify(match.skillBreakdown),
          'matched',
        ]
      );
    }
  }
}
```

---

## Week 9-10: Frontend MVP (1.8)

**Key Pages to Build**:
1. Login/Register pages
2. Candidate Dashboard
3. Profile Management
4. Resume Upload UI
5. Job Listings
6. Employer Dashboard
7. Job Posting Form
8. Candidate Matches View

---

## Week 11: Testing & Bug Fixes (1.9)

**End-to-End Testing**:
- User registration → profile creation → resume upload
- Company registration → job posting with skills
- Manual skill entry → matching algorithm → view matches

---

## Phase 1 Deliverables Checklist

- [ ] Auth service with registration, login, JWT tokens
- [ ] Candidate profile CRUD
- [ ] Company profile CRUD
- [ ] Resume upload to S3
- [ ] Basic resume parsing
- [ ] Skills API
- [ ] Job posting with required skills
- [ ] Basic matching algorithm (manual scores)
- [ ] Frontend UI for all features
- [ ] Integration tests for all services
- [ ] API documentation

**Success Criteria**:
- Users can register and login
- Candidates can create profiles and upload resumes
- Companies can post jobs with skill requirements
- Basic matching works with manual skill scores
- 10+ test users complete full flow

**Ready for Phase 2: Interview System**
