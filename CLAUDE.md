# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobGraph is a skills-based job matching platform where candidates interview once per skill (e.g., Python, Machine Learning) and get matched to multiple jobs based on their verified skill scores. The platform uses AI for resume parsing and interview evaluation, hosted entirely on AWS.

**Core Value Proposition**: Candidates take skill-specific interviews that are reused across all job applications, eliminating redundant assessments. Employers receive ranked candidates with verified skill scores.

**Current Phase**: Phase 1 In Progress - All 5 backend services (Auth, Profile, Job, Skills, Matching) are complete and tested. Frontend authentication, layout, and Profile Management page are complete. Working on Skills Management and other candidate/employer feature pages.

## Architecture

### Project Structure

The project is organized as:

```
JobGraph/
├── backend/           # Backend microservices (npm workspace)
│   ├── common/       # Shared package (@jobgraph/common)
│   └── services/     # Individual microservices
├── frontend/         # React + TypeScript frontend
├── scripts/          # Database setup and test scripts
└── docs/            # Documentation
```

### Backend Monorepo Structure

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
- **Enhanced holistic matching algorithm** calculates comprehensive compatibility scores
- POST /api/v1/matching/jobs/:jobId/calculate - Calculate matches for a job
  - Finds candidates with ALL required skills
  - Checks minimum score thresholds
  - Calculates weighted skill average: Σ(skill_score[i] × weight[i]) / Σ(weight[i])
  - Applies penalty for missing required skills (0/2 required = max 25%, 1/2 = max 50%)
  - Adds bonus points for profile factors (up to 15 points):
    - Experience level match (0-5 points)
    - Location/remote preference (0-5 points)
    - Education relevance (0-3 points)
    - Work experience relevance (0-2 points)
  - Final score: skill score + bonus points (capped at 100%)
  - Ranks candidates by overall score
  - Stores matches in `job_matches` table
- GET /api/v1/matching/jobs/:jobId/candidates - Employer views ranked candidates
  - Returns candidates sorted by match_rank
  - Includes skill breakdown with individual scores
  - Shows overall match score and candidate details
- GET /api/v1/matching/candidate/matches - Candidate views job matches
  - Returns all jobs matched to the candidate (stored matches only)
  - Shows match score, rank, and job details
- **GET /api/v1/matching/candidate/browse-jobs** - Browse ALL jobs with calculated scores
  - Calculates match score for EVERY active job in real-time
  - Shows partial matches even if missing required skills
  - Includes qualification status (fully qualified vs partial)
  - Returns required skills met count and total required skills
  - Separates required vs optional skills in breakdown
- POST /api/v1/matching/matches/:matchId/contact - Employer contacts candidate
  - Updates status to 'contacted'
  - Sets contacted_at timestamp
  - Placeholder for notification (Phase 2: SES email)
- PUT /api/v1/matching/matches/:matchId/status - Update match status
  - **IMPORTANT**: Valid statuses must match database constraint: `matched`, `viewed`, `contacted`, `shortlisted`, `rejected`, `hired`
  - Employer-only action
- Algorithm behavior:
  - Missing required skills significantly lower match scores (penalty system)
  - Optional skills add bonus points if candidate has them
  - Profile factors (experience, location, education) provide up to 15% bonus
  - Scores are more differentiated and realistic (not all clustering around 85%)
- Database columns use `city`, `state` (not `location_city`, `location_state`)
- Work experience table uses `title`, `company` (not `job_title`, `company_name`)

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

### Frontend Architecture

The frontend is a React 19 single-page application built with Vite:

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/       # Reusable UI components (Button, Input, Card, etc.)
│   │   └── layout/       # Layout components (Navbar, Layout, ProtectedRoute)
│   ├── contexts/         # Zustand stores (AuthContext)
│   ├── pages/           # Page components
│   │   ├── auth/        # Login, Register
│   │   ├── candidate/   # Candidate dashboard and pages
│   │   └── employer/    # Employer dashboard and pages
│   ├── services/        # API client and service layers
│   ├── types/           # TypeScript type definitions
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   └── App.tsx          # Main app component with routes
├── public/              # Static assets
└── package.json
```

**Key Frontend Technologies:**
- **React 19** with TypeScript for type safety
- **Vite** for fast development and hot module replacement
- **Tailwind CSS v4** with @theme directive and CSS variables
- **React Router v7** for client-side routing with protected routes
- **Zustand** for global state management (auth, toasts)
- **React Query** for server state management and caching
- **Axios** with interceptors for API calls and automatic token refresh

**API Client Configuration:**
The frontend uses 5 separate Axios instances, one for each microservice:
```typescript
// Auth Service (Port 3000)
const authApi = axios.create({ baseURL: 'http://localhost:3000' });

// Profile Service (Port 3001)
const profileApi = axios.create({ baseURL: 'http://localhost:3001' });

// Job Service (Port 3002)
const jobApi = axios.create({ baseURL: 'http://localhost:3002' });

// Skills Service (Port 3003)
const skillsApi = axios.create({ baseURL: 'http://localhost:3003' });

// Matching Service (Port 3004)
const matchingApi = axios.create({ baseURL: 'http://localhost:3004' });
```

**Authentication Flow:**
1. User logs in via LoginPage → calls authService.login()
2. Backend returns access token (15 min) and refresh token (7 days)
3. Tokens stored in localStorage via setTokens()
4. Auth state persisted in Zustand store with user object
5. All API requests include `Authorization: Bearer <token>` header via Axios interceptor
6. On 401 response, refresh interceptor automatically tries to refresh token
7. If refresh succeeds, retry original request with new token
8. If refresh fails, clear tokens and redirect to login

**Protected Routes:**
Routes use ProtectedRoute wrapper to check authentication and role:
```typescript
<Route path="/candidate/dashboard" element={
  <ProtectedRoute requiredRole="candidate">
    <CandidateDashboard />
  </ProtectedRoute>
} />
```

**Component Library:**
Built 8 reusable components following consistent API patterns:
- **Button**: 4 variants (primary, secondary, danger, ghost), 3 sizes, loading state
- **Input**: Text/email/password with label, error, helper text, show/hide password
- **Textarea**: Multi-line input with same features
- **Select**: Dropdown with options array
- **Card**: Content container with optional title/subtitle
- **LoadingSpinner**: 3 sizes (sm, md, lg)
- **Modal**: Overlay modal with 4 sizes, backdrop click to close
- **Toast**: Notification system with 4 types (success, error, info, warning), auto-dismiss after 5s

**UX Features Implemented:**
- Password visibility toggle with eye/eye-slash icons (correct logic: eye = visible)
- Clickable logo navigation from auth pages to homepage
- Homepage auto-redirects authenticated users to their dashboard
- Form validation with real-time error display
- Toast notifications for success/error feedback
- Loading states on buttons during async operations
- Modal forms for complex data entry (education, work experience)
- Auto-refresh data after updates to show latest state

**Type Safety:**
All API responses, entities, and form data have TypeScript type definitions in `types/index.ts`:
- User, AuthResponse, CandidateProfile, Company, Job, Skill, JobMatch
- Education, WorkExperience, UserSkillScore
- LoginFormData, RegisterFormData
- ApiResponse<T> wrapper matching backend format

**Field Name Mapping:**
The frontend handles field name conversion between backend (snake_case) and display (camelCase):
- Backend: `education_id`, `field_of_study`, `graduation_year` → Frontend: accessed as-is with `any` type in maps
- Backend: `experience_id`, `start_date`, `is_current` → Frontend: accessed as-is with `any` type in maps
- Form data sent to backend uses snake_case field names expected by API

**Pages Implemented:**
1. **ProfilePage** (`/candidate/profile`) - Complete CRUD for candidate profiles:
   - Basic info: headline, summary, location, years of experience, remote preference (onsite/hybrid/remote/flexible), willing to relocate, profile visibility
   - Education: degree, field of study, institution, graduation year, GPA (modal form)
   - Work experience: job title, company, start/end dates, current position flag, description (modal form)
   - All operations use proper field name mapping and auto-refresh profile after updates

2. **SkillsPage** (`/candidate/skills`) - Complete CRUD for manual skill scores:
   - Two-tab interface: "My Skills" (manage existing) and "Browse Skills" (discover new)
   - Browse tab: category dropdown filter (all, programming, data_science, cloud, ai, finance) + search by name
   - Skills displayed with category badges and descriptions
   - Add skill: modal with 0-100 slider, visual score feedback, proficiency labels (Beginner/Intermediate/Advanced/Expert)
   - Score color coding: red (0-39), yellow (40-59), blue (60-79), green (80-100)
   - Score guidelines shown in modal: 0-39: Beginner, 40-59: Intermediate, 60-79: Advanced, 80-100: Expert
   - Edit skill: same modal for updating scores
   - Delete skill: confirmation prompt before removal
   - Duplicate prevention: shows info toast if skill already added, suggests editing from My Skills tab
   - Displays acquired_at and expires_at dates (1 year expiry for manual entries)
   - Empty state with CTA to browse skills
   - Backend consistency: Skills Service returns snake_case (skill_id, skill_name, created_at)
   - All CRUD operations use profileService for user_skill_scores table (interview_id = NULL for manual entries)

3. **JobMatchesPage** (`/candidate/job-matches`) - Browse and view all job matches:
   - Displays ALL active jobs with real-time calculated match scores (not just stored matches)
   - Match score badge with color coding (green ≥80%, blue ≥60%, yellow ≥40%, red <40%)
   - Qualification status: "✓ Fully Qualified" or "X/Y Required Skills Met"
   - **Clear skill separation**: Required skills and Optional skills (Bonus) shown in separate sections
   - Color-coded skill badges:
     - Required skills: green (meets threshold), red (missing/below threshold)
     - Optional skills: blue (have it), gray (don't have it)
   - Filter options:
     - Location type: All, Remote Only, On-site Only
     - Qualification: All Jobs, Fully Qualified, Partial Match
   - Sort options: Match Score (high to low), Recently Posted
   - Job detail modal with comprehensive breakdown:
     - Full job description
     - Skill Match Breakdown section with Required and Optional skills separated
     - Visual progress bars showing skill scores vs thresholds
     - Skill weights displayed (e.g., "Weight: 40%")
     - Status badges (Missing, Below Minimum, Optional, etc.)
   - Displays job details: location, salary range, employment type, experience level, company info
   - Empty state when no jobs available or filters exclude all jobs

4. **CompanyProfilePage** (`/employer/company`) - Complete CRUD for employer company profiles:
   - First-time setup flow: auto-enables edit mode if employer has no company (404 detection)
   - View/Edit mode toggle with seamless transitions
   - Company details: name (required), description, industry, size, website, location (city, state, country)
   - Industry dropdown: technology, finance, healthcare, education, retail, manufacturing, consulting, media, real estate, hospitality, other
   - Company size options: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5000+ employees
   - Form validation with required field checks
   - Success/error toast notifications
   - Metadata display: created date and last updated timestamp
   - Backend API returns camelCase format with nested location object (city, state, country)
   - Frontend types updated to match: `Company` interface with `companyId`, `name`, `companySize`, `location: {city, state, country}`
   - All CRUD operations via `companyService` using Profile Service API (port 3001)

### Enhanced Matching Algorithm

The matching algorithm uses a **holistic scoring approach** that considers skills, profile factors, education, and work experience:

```typescript
function calculateJobMatchScore(userId: string, jobId: string) {
    // 1. Base Skill Score Calculation
    // Calculate weighted average of candidate's skill scores
    let skillScore = Σ(skill_score[i] × weight[i]) / Σ(weight[i])

    // 2. Apply Penalty for Missing Required Skills
    // This significantly reduces scores when requirements aren't met
    requiredSkillsRatio = requiredSkillsMet / totalRequiredSkills
    if (requiredSkillsMet < totalRequiredSkills) {
        maxScore = requiredSkillsRatio × 50 + 25
        // 0/2 required = max 25%, 1/2 required = max 50%, 2/2 required = no cap
        skillScore = min(skillScore, maxScore)
    }

    // 3. Add Bonus Points for Profile Factors (max 15 points)
    bonusPoints = 0

    // Experience level match (0-5 points)
    if (candidate.yearsExperience matches job.experienceLevel) {
        bonusPoints += 5  // Perfect match
    } else if (closeMatch) {
        bonusPoints += 2  // Partial match
    }

    // Location/Remote preference (0-5 points)
    if (job.remote && candidate.prefersRemote) {
        bonusPoints += 5
    } else if (sameCity || willingToRelocate) {
        bonusPoints += 1-5  // Based on specifics
    }

    // Education relevance (0-3 points)
    if (fieldOfStudy mentioned in job title/description) {
        bonusPoints += 3
    } else if (hasRelevantDegree) {
        bonusPoints += 1
    }

    // Work experience relevance (0-2 points)
    if (similar job titles in work history) {
        bonusPoints += 2
    }

    // 4. Calculate Final Score
    overallScore = min(skillScore + bonusPoints, 100)

    return {
        overallScore,
        isFullyQualified: requiredSkillsMet === totalRequiredSkills,
        requiredSkillsMet,
        totalRequiredSkills,
        skillBreakdown: [...]
    }
}
```

**Key Algorithm Features:**
- **Penalty for missing required skills**: Jobs where you lack required skills show realistic low scores (25-50%)
- **Holistic evaluation**: Not just skills - considers your entire profile
- **Differentiated scores**: Jobs scored 30%, 50%, 75%, 95% instead of all clustering at 85%
- **Optional skills**: Provide bonus points but don't penalize if missing
- **Browse mode**: In the browse-jobs endpoint, ALL jobs are scored even if you're not fully qualified (unlike calculateJobMatches which only stores perfect matches)

**Important Distinctions:**
- `calculateJobMatches()` - Employer-triggered, stores only candidates who meet ALL required skills + thresholds
- `browseJobsWithScores()` - Candidate-facing, scores ALL active jobs including partial matches for exploration

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

**Development Services Manager** (Recommended):
```bash
# From project root directory
./dev-services.sh              # Start all services (5 backend + 1 frontend)
                               # Checks Docker, builds common package, starts all services
                               # Monitors all processes, shows status
                               # Press Ctrl+C to gracefully stop everything
                               # Logs available at /tmp/jobgraph-*.log
```

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

**Frontend Development**:
```bash
# From frontend directory
npm install                    # Install all dependencies
npm run dev                   # Start Vite dev server on port 5173
npm run build                 # Build for production
npm run preview               # Preview production build locally
npm run lint                  # Lint code with ESLint
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

**Phase 1 (Current)**: MVP Backend Complete ✅, Frontend Candidate Pages Complete ✅, Company Profile Complete ✅ - See [PHASE_1_CHECKLIST.md](PHASE_1_CHECKLIST.md)
- ✅ Auth Service (local auth with JWT) - `/api/v1/auth/*` on port 3000
- ✅ Profile Service (CRUD operations + manual skill scores + company profiles) - `/api/v1/profiles/*` on port 3001
- ✅ Job Service (posting and management) - `/api/v1/jobs/*` on port 3002
- ✅ Skills Service (browsing and search) - `/api/v1/skills/*` on port 3003
- ✅ Matching Service (enhanced holistic algorithm) - `/api/v1/matching/*` on port 3004
- ✅ Frontend Authentication & Layout - Login, register, common components, protected routes
- ✅ Frontend Candidate Pages - Profile, Skills, Job Matches (browse all jobs with match scores)
- ✅ Company Profile Page - First-time setup flow, view/edit company details
- 🔄 Frontend Employer Pages - Job posting, job management, candidate matches (next priority)

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
