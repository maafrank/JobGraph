# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobGraph is a skills-based job matching platform where candidates interview once per skill (e.g., Python, Machine Learning) and get matched to multiple jobs based on their verified skill scores. The platform uses AI for resume parsing and interview evaluation, hosted entirely on AWS.

**Core Value Proposition**: Candidates take skill-specific interviews that are reused across all job applications, eliminating redundant assessments. Employers receive ranked candidates with verified skill scores.

**Current Phase**: Phase 1 In Progress - Auth, Profile, Job, and Skills services are complete and tested. Ready to continue with Matching Service.

## Architecture

### Monorepo Structure

The backend uses npm workspaces with a shared common package:

```
backend/
├── package.json (workspace root)
├── common/ (@jobgraph/common package)
│   ├── src/
│   │   ├── database/    # PostgreSQL pool, Redis client, query helpers
│   │   ├── types/       # Shared TypeScript interfaces
│   │   └── utils/       # Auth, validation, response formatters
│   └── dist/            # Compiled output
├── services/
│   ├── auth-service/
│   ├── profile-service/
│   ├── interview-service/
│   ├── job-service/
│   ├── matching-service/
│   └── notification-service/
└── tests/
    ├── unit/
    └── integration/
```

**Import Pattern**: All services import from `@jobgraph/common`:
```typescript
import { pool, query, hashPassword, User, ApiResponse } from '@jobgraph/common';
```

### Microservices Structure

The system consists of 7 main services (to be deployed on AWS ECS):

1. **Authentication Service** - User registration/login (local auth in Phase 1, Cognito in Phase 4)
2. **Profile Service** - Resume upload, AI parsing (Textract), profile management, manual skill scores
3. **Skills Service** - Skill browsing, categories, search (public API)
4. **Interview Service** - Generate interviews, administer assessments, AI scoring (Bedrock)
5. **Job Service** - Job CRUD operations, skill requirement management
6. **Matching Service** - Calculate candidate-job compatibility scores
7. **Notification Service** - Email (SES) and in-app notifications

### Key Data Models

Refer to [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) for complete schema. Critical relationships:

- `users` → `candidate_profiles` (1:1) → `education`, `work_experience` (1:N)
- `skills` → `interview_templates` → `questions` (skill assessment templates)
- `interviews` → `interview_responses` (user's interview attempt and answers)
- `user_skill_scores` (derived from completed interviews, used for matching)
- `jobs` → `job_skills` (required skills with weights and minimum thresholds)
- `job_matches` (candidate-job pairs with compatibility scores)

### Service Implementation Details

**Auth Service** (Port 3000):
- Auto-creates `candidate_profiles` record on registration for `role='candidate'`
- JWT payload uses `user_id` (not `userId`) to match `JwtPayload` interface
- Database uses `user_id` as primary key (not `id`)
- Token expiration configured via `JWT_EXPIRES_IN` env variable

**Profile Service** (Port 3001):
- All routes require authentication via `authenticate` middleware
- Uses COALESCE pattern for partial updates (only updates provided fields)
- Education and work experience tables don't have `updated_at` column (only base profile does)
- Returns nested JSON with education and work experience arrays
- Authorization check: queries join through `candidate_profiles` to verify ownership
- Manual skill score management:
  - `GET /api/v1/profiles/candidate/skills` - View candidate's skill scores
  - `POST /api/v1/profiles/candidate/skills` - Add skill score (0-100 validation)
  - `PUT /api/v1/profiles/candidate/skills/:skillId` - Update skill score
  - `DELETE /api/v1/profiles/candidate/skills/:skillId` - Remove skill
  - Skill scores stored in `user_skill_scores` with NULL `interview_id` for manual entries
  - Auto-expiry set to 1 year from entry date

**Skills Service** (Port 3003):
- Public API (no authentication required for browsing skills)
- GET /api/v1/skills - List all skills with pagination, filtering, and search
  - Supports `?page=1&limit=20` for pagination
  - Supports `?category=programming` for filtering by category
  - Supports `?search=Python` for case-insensitive name search
  - Supports `?active=true` to filter active/inactive skills
- GET /api/v1/skills/categories - Get distinct skill categories
- GET /api/v1/skills/:id - Get specific skill details
- Skills seeded in Phase 0 (35 skills across 5 categories: programming, data_science, cloud, ai, finance)

**Job Service** (Port 3002):
- Employer-only routes for creating/modifying jobs (role-based access control)
- Ownership verification via `company_users` table join
- Public routes for listing and viewing jobs
- Skills table uses `active` column (not `is_active`)
- Companies table uses `company_size` column (not `size`)
- Job status workflow: draft → active → closed/cancelled
- Supports pagination, filtering, and search for job listings

**Matching Service** (Port 3004):
- Core matching algorithm calculates weighted compatibility scores
- POST /api/v1/matching/jobs/:jobId/calculate - Calculate matches for a job
  - Finds candidates with ALL required skills
  - Checks minimum score thresholds
  - Calculates weighted average: Σ(skill_score[i] × weight[i]) / Σ(weight[i])
  - Ranks candidates by overall score
  - Stores matches in `job_matches` table
- GET /api/v1/matching/jobs/:jobId/candidates - Employer views ranked candidates
  - Returns candidates sorted by match_rank
  - Includes skill breakdown with individual scores
  - Shows overall match score and candidate details
- GET /api/v1/matching/candidate/matches - Candidate views job matches
  - Returns all jobs matched to the candidate
  - Shows match score, rank, and job details
- POST /api/v1/matching/matches/:matchId/contact - Employer contacts candidate
  - Updates status to 'contacted'
  - Sets contacted_at timestamp
  - Placeholder for notification (Phase 2: SES email)
- PUT /api/v1/matching/matches/:matchId/status - Update match status
  - **IMPORTANT**: Valid statuses must match database constraint: `matched`, `viewed`, `contacted`, `shortlisted`, `rejected`, `hired`
  - Employer-only action
- Algorithm enforces: candidates must have ALL required skills and meet minimum thresholds
- Optional skills are included in scoring if candidate has them
- Database columns use `city`, `state` (not `location_city`, `location_state`)

### Common Package API

**Database** (`@jobgraph/common/database`):
- `pool` - PostgreSQL connection pool (max 20 connections)
- `redis` - Redis client with retry strategy
- `query(text, params)` - Execute parameterized queries
- `transaction(callback)` - Execute in transaction with auto-rollback
- `testDatabaseConnection()` - Health check
- `testRedisConnection()` - Health check

**Types** (`@jobgraph/common/types`):
- `User`, `CandidateProfile`, `Skill`, `Job` - Database models
- `ApiResponse<T>` - Standard API response wrapper
- `JwtPayload` - JWT token structure

**Utils** (`@jobgraph/common/utils`):
- `hashPassword(password)` - Bcrypt hash with 10 rounds
- `comparePassword(password, hash)` - Verify password
- `generateToken(payload)` - Create JWT (expiry from env)
- `verifyToken(token)` - Validate JWT
- `isValidEmail(email)` - Email regex validation
- `isValidPassword(password)` - Password strength check (8+ chars, upper, lower, number, special)
- `successResponse(data, pagination?)` - Format success response
- `errorResponse(code, message, details?)` - Format error response
- `AppError` - Custom error class with statusCode, code, message, details

### Matching Algorithm

The core algorithm calculates job match scores:

```typescript
function calculateJobMatchScore(userId: string, jobId: string) {
    // Get user's skill scores from completed interviews
    // For each required skill in job:
    //   - Check user has completed interview (user_skill_scores)
    //   - Verify user_score >= minimum_score (else disqualify)
    //   - Apply skill weight to score
    // Return weighted average: Σ(skill_score[i] × weight[i]) / Σ(weight[i])
}
```

**Critical constraint**: Users must have completed interviews for ALL required skills in a job to be matched. Optional skills can be missing.

## Development Workflow

### Initial Setup

**Prerequisites**: Node.js 18+, Docker Desktop

```bash
# 1. Install dependencies
cd backend && npm install

# 2. Start Docker services (PostgreSQL, Redis, Adminer)
docker-compose up -d

# 3. Load database schema and seed data
./scripts/setup-database.sh
# Or manually:
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql
cd backend && npx ts-node ../scripts/seed-data/seed-skills.ts
cd backend && npx ts-node ../scripts/seed-data/seed-test-users.ts

# 4. Build common package
cd backend/common && npm run build

# 5. Verify setup
cd backend && npm test
```

### Common Commands

**Backend Development**:
```bash
# From backend directory
npm install                    # Install all dependencies (workspaces)
npm test                       # Run all tests with Jest
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Generate coverage report
npm run lint                  # Lint TypeScript code with ESLint
npm run format                # Format code with Prettier

# Build common package (must do this before services can import it)
cd common && npm run build    # Compile TypeScript to dist/
cd common && npm run dev      # Watch mode - rebuilds on changes

# Run individual services (Phase 1 - all 5 services implemented)
npm run dev:auth              # Start auth service on port 3000
npm run dev:profile           # Start profile service on port 3001
npm run dev:job               # Start job service on port 3002
npm run dev:skill             # Start skills service on port 3003
npm run dev:matching          # Start matching service on port 3004
npm run dev:interview         # Start interview service (Phase 2+)
npm run dev:notification      # Start notification service (Phase 2+)
```

**Docker & Database**:
```bash
# Docker management
docker-compose up -d          # Start PostgreSQL, Redis, Adminer
docker-compose down           # Stop all services
docker-compose ps             # Check service status
docker-compose logs -f        # View logs (all services)
docker-compose logs -f postgres  # View PostgreSQL logs only

# Database access
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev
# Or use Adminer web UI: http://localhost:8080

# Migrations (when needed)
npm run migrate:create <name> # Create new migration
npm run migrate:up            # Run pending migrations
npm run migrate:down          # Rollback last migration
```

**Testing**:
```bash
# Jest Unit Tests
npm test                           # Run all tests
npm test -- utils.test.ts          # Run specific test file
npm test -- --testNamePattern="Password"  # Run tests matching pattern
npm run test:watch                 # Watch mode
npm run test:coverage              # Generate coverage report

# API Integration Tests (must have Docker services and services running)
./scripts/test-auth-api.sh         # Test Auth Service (9 tests)
./scripts/test-profile-api.sh      # Test Profile Service (14 tests)
./scripts/test-job-api.sh          # Test Job Service (13 tests)
./scripts/test-skills-api.sh       # Test Skills Service (17 tests)

# Phase Test Suites
./scripts/test-phase0.sh           # Verify Phase 0 foundation
./scripts/test-phase1.sh           # Verify Phase 1 services (36 tests, all passing ✅)
```

### Adding a New Service

Each service follows this structure:

```bash
# 1. Create package.json in service directory
cat > backend/services/auth-service/package.json << 'EOF'
{
  "name": "@jobgraph/auth-service",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@jobgraph/common": "*",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "dotenv": "^16.3.0"
  }
}
EOF

# 2. Create tsconfig.json
cat > backend/services/auth-service/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF

# 3. Install dependencies
cd backend && npm install

# 4. Create src/index.ts and implement service
```

## Important Business Rules

### Interview Validity
- Interviews expire after 6-12 months (configurable via `interviews.valid_until`)
- One interview per user per skill (`UNIQUE(user_id, skill_id)` constraint)
- User can retake expired interviews to refresh scores

### Job Matching Rules
1. Candidate MUST have completed interviews for all required skills (`job_skills.required = true`)
2. Candidate MUST meet minimum score threshold for each required skill (`job_skills.minimum_score`)
3. Match score is weighted average of skill scores using `job_skills.weight`
4. Candidates are ranked by `overall_score` (stored in `job_matches.match_rank`)

### Privacy & Visibility
- Candidate profiles can be `public`, `private`, or `anonymous` (`candidate_profiles.profile_visibility`)
- Employers only see matched candidates (never browse all candidates)
- Candidate identity hidden until employer initiates contact

## API Design Patterns

All APIs follow REST conventions under `/api/v1/`:

**Authentication**: JWT tokens (local in Phase 1, Cognito in Phase 4), passed in `Authorization: Bearer <token>` header

**Pagination**: Use `?page=1&limit=20` query params, return:
```json
{
  "data": [...],
  "pagination": {"page": 1, "limit": 20, "total": 150, "pages": 8}
}
```

**Success Response** (use `successResponse()` helper):
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response** (use `errorResponse()` helper):
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_SKILL_SCORE",
    "message": "Your Python score (55) is below the minimum required (70)",
    "details": {"skill": "Python", "user_score": 55, "required": 70}
  }
}
```

**Key Endpoints** (see [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) for full list):
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/interviews/:skill_id/start` - Begin interview (locks user to skill)
- `PUT /api/v1/interviews/:interview_id/submit` - Submit answers, trigger scoring
- `GET /api/v1/jobs/:job_id/candidates` - Employer-only, returns ranked matches
- `POST /api/v1/jobs/:job_id/contact-candidate` - Initiate contact, notify candidate

## Security Requirements

- **Use parameterized queries**: Always use `query(text, params)` - NEVER string concatenation
- **Password requirements**: Enforced by `isValidPassword()` - 8+ chars, upper, lower, number, special
- **JWT secrets**: Stored in `.env` (local) or AWS Secrets Manager (production)
- **Never expose raw candidate data** to employers before contact is initiated
- **File upload validation**: Max 10MB, only PDF/DOCX (Phase 1+)
- **Rate limiting**: 100 requests/minute per user (API Gateway in Phase 4)
- **CORS**: Whitelist frontend domains only

## Testing Strategy

**Unit Tests**: Individual functions, especially:
- Password hashing and validation
- JWT token generation/verification
- Matching algorithm with various skill combinations
- Interview scoring logic

**Integration Tests**:
- API endpoints with real database (use test database)
- Database operations with transactions
- Redis caching

**E2E Tests** (Phase 2+):
- Resume upload → parsing → profile auto-fill
- Interview flow → scoring → skill scores
- Job posting → matching → candidate ranking

**Test Database**:
- Use `jobgraph_test` database for tests
- Set `DATABASE_NAME=jobgraph_test` in test environment
- Reset database between test suites

## AWS Infrastructure (Phase 4)

See [AWS_INFRASTRUCTURE.md](AWS_INFRASTRUCTURE.md) for complete details.

**Key Services**:
- **Compute**: ECS Fargate (services), Lambda (event-driven functions)
- **Database**: RDS PostgreSQL (primary), DynamoDB (sessions), ElastiCache Redis (cache)
- **Storage**: S3 (resumes, assets)
- **AI/ML**: Textract (resume parsing), Bedrock Claude 3.5 Sonnet (interview evaluation)
- **Auth**: Cognito (user pools)

**Infrastructure as Code**: Use AWS CDK (TypeScript) in `infrastructure/` directory.

## Development Phases

**Phase 0**: Complete ✅ - Foundation established (Docker, PostgreSQL, Redis, Common package)

**Phase 1 (Current)**: MVP Backend Complete ✅ - See [PHASE_1_CHECKLIST.md](PHASE_1_CHECKLIST.md)
- ✅ Auth Service (local auth with JWT) - `/api/v1/auth/*` on port 3000
- ✅ Profile Service (CRUD operations + manual skill scores) - `/api/v1/profiles/*` on port 3001
- ✅ Job Service (posting and management) - `/api/v1/jobs/*` on port 3002
- ✅ Skills Service (browsing and search) - `/api/v1/skills/*` on port 3003
- ✅ Matching Service (weighted matching algorithm) - `/api/v1/matching/*` on port 3004
- 🔄 Frontend (React + TypeScript) - Next to implement

**Phase 2**: Interview system with AI scoring
**Phase 3**: Search, analytics, enhanced features
**Phase 4**: AWS deployment, production infrastructure

## References

- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Complete architecture, data models, algorithms
- [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) - PostgreSQL schema with indexes and views
- [AWS_INFRASTRUCTURE.md](AWS_INFRASTRUCTURE.md) - AWS service configurations
- [EXECUTION_PLAN.md](EXECUTION_PLAN.md) - Implementation roadmap
- [DEV_SETUP.md](DEV_SETUP.md) - Development environment setup guide
- [PHASE_0_CHECKLIST.md](PHASE_0_CHECKLIST.md) - Phase 0 verification checklist
- [PHASE_1_CHECKLIST.md](PHASE_1_CHECKLIST.md) - Phase 1 implementation progress tracker
