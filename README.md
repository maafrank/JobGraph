# JobGraph

**Skills-Based Job Matching Platform**

JobGraph is an intelligent job matching platform that revolutionizes hiring by focusing on verified skills rather than just resumes. Candidates interview once per skill, and their scores are used to match them with multiple relevant jobs.

## Core Concept

- **Candidates**: Upload resume, complete skill-based interviews, get matched to jobs
- **Companies**: Post jobs with required skills, get ranked list of qualified candidates
- **One Interview Per Skill**: Candidates interview once for each skill (e.g., Python, Machine Learning), and that score applies to all jobs requiring that skill
- **Intelligent Matching**: AI-powered scoring matches candidates to jobs based on skill proficiency and job requirements

## Key Features

### For Candidates
- Resume upload with AI-powered parsing and auto-fill
- Skill-based interviews (reusable across multiple jobs)
- Personalized job recommendations based on skill scores
- Track skill proficiency and compare with others
- Interview once, apply to many jobs

### For Employers
- Post jobs with specific skill requirements and weights
- View ranked candidates by compatibility score
- Access verified skill assessments
- Filter candidates by skill proficiency levels
- Connect directly with top matches

### Platform Features
- AI-powered resume parsing (AWS Textract)
- Intelligent interview generation and scoring (AWS Bedrock)
- Multi-skill job matching algorithm
- Real-time notifications
- Comprehensive analytics

## Technology Stack

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS v4
- React Router v7 (client-side routing)
- Zustand (state management)
- React Query (@tanstack/react-query) for server state
- Axios (HTTP client with interceptors)

### Backend
- Node.js + TypeScript
- Express.js (microservices framework)
- PostgreSQL (primary database)
- Redis (caching)
- npm workspaces (monorepo structure)
- JWT authentication (local, migrating to Cognito in Phase 4)

### AWS Services
- **Compute**: ECS Fargate, Lambda
- **Database**: RDS (PostgreSQL), DynamoDB, ElastiCache (Redis)
- **Storage**: S3
- **AI/ML**: Textract (resume parsing), Bedrock (interview evaluation)
- **Search**: OpenSearch
- **Auth**: Cognito
- **API**: API Gateway
- **Notifications**: SES, SNS
- **Monitoring**: CloudWatch, X-Ray

## Documentation

### Architecture & Design
- [System Design](./SYSTEM_DESIGN.md) - Comprehensive system architecture and design
- [Database Schema](./DATABASE_SCHEMA.sql) - Complete PostgreSQL schema
- [AWS Infrastructure](./AWS_INFRASTRUCTURE.md) - AWS setup and deployment guide
- [CLAUDE.md](./CLAUDE.md) - Development guidelines for Claude Code

### Implementation Plans
- [Execution Plan](./EXECUTION_PLAN.md) - High-level roadmap and phases overview
- [Phase 0: Foundation](./PHASE_0_DETAILED_PLAN.md) - Development environment setup (Week 1-2)
- [Phase 1: MVP](./PHASE_1_DETAILED_PLAN.md) - Core features and basic matching (Week 3-11)
- [Phase 2: Interview System](./PHASE_2_DETAILED_PLAN.md) - AI-powered interviews and scoring (Week 12-18)
- [Phase 3-5: Enhancement & Production](./PHASE_3_4_5_DETAILED_PLAN.md) - Search, analytics, AWS deployment, launch (Week 19-34+)

## Getting Started

### Prerequisites
- Node.js 18+
- Docker Desktop
- PostgreSQL (via Docker)
- Redis (via Docker)

### Backend Setup

```bash
# 1. Install dependencies
cd backend && npm install

# 2. Start Docker services (PostgreSQL, Redis, Adminer)
docker-compose up -d

# 3. Load database schema and seed data
./scripts/setup-database.sh

# 4. Build common package
cd backend/common && npm run build

# 5. Start all backend services
cd backend
npm run dev:auth      # Port 3000
npm run dev:profile   # Port 3001
npm run dev:job       # Port 3002
npm run dev:skill     # Port 3003
npm run dev:matching  # Port 3004
```

### Frontend Setup

```bash
# 1. Install dependencies
cd frontend && npm install

# 2. Start development server
npm run dev

# Frontend runs on http://localhost:5173
```

### Test Accounts

After seeding, these test accounts are available:

**Candidate:**
- Email: candidate@test.com
- Password: Test123!

**Employer:**
- Email: employer@test.com
- Password: Test123!

### Running Tests

```bash
# Unit tests
cd backend && npm test

# API integration tests (requires services running)
./scripts/test-phase1.sh  # All 40 tests

# Individual service tests
./scripts/test-auth-api.sh
./scripts/test-profile-api.sh
./scripts/test-job-api.sh
./scripts/test-skills-api.sh
```

## Architecture Overview

```
Candidates → Resume Upload → AI Parsing → Profile Creation
          ↓
     Skill Interviews → AI Scoring → Skill Scores
          ↓
     Job Matching Algorithm → Ranked Matches
          ↓
     Employers View Candidates → Contact Top Matches
```

## Matching Algorithm

Jobs require multiple skills with different weights. For example:
- Senior ML Engineer: Machine Learning (40%), Python (30%), Data Engineering (20%), AWS (10%)

The system calculates a match score for each candidate based on their skill interview scores:
```
match_score = Σ(skill_score[i] × weight[i]) / Σ(weight[i])
```

Candidates must meet minimum thresholds for each required skill to qualify.

## Current Implementation Status

### Completed Features (Phase 1)

**Backend Services (All Complete ✅):**
- Authentication Service - User registration, login, JWT tokens
- Profile Service - Candidate profiles, education, work experience, company profiles, manual skill scores
- Job Service - Job CRUD operations, skill requirement management
- Skills Service - Skill browsing, categories, search (35 skills seeded)
- Matching Service - Enhanced holistic matching algorithm with profile factors

**Frontend Pages (Candidate - All Complete ✅):**
- Profile Management - Edit profile, add education, add work experience
- Skills Management - Browse skills, add/edit/delete skill scores with proficiency sliders
- Job Matches - Browse all jobs with real-time match scores, filter by qualification/location, detailed skill breakdowns

**Frontend Pages (Employer - In Progress 🔄):**
- ✅ Company Profile - First-time setup, view/edit company details
- ✅ Job Posting Form - Create/edit jobs with title, description, requirements, responsibilities, location, salary, employment type, experience level, skill requirements (add required/optional skills with weights and minimum score thresholds)
- 🔄 Job Management - List jobs, edit, close, trigger matching (next priority)
- 🔄 Candidate Matches - View ranked candidates per job (next priority)

**Key Technical Achievements:**
- Field name mapping: Frontend camelCase ↔ Backend camelCase API ↔ Database snake_case
- Weight conversion: Frontend 0-100% ↔ Database DECIMAL(3,2) 0.0-1.0
- Modal forms with sliders for skill management
- Color-coded skill badges and proficiency indicators
- Real-time match score calculation with holistic algorithm
- Type-safe TypeScript interfaces across frontend/backend

## Development Phases

### Phase 1: MVP (3-4 months) - In Progress 🔄
- ✅ User authentication and basic profiles
- 🔄 Resume upload and parsing (backend ready, frontend pending)
- ✅ Manual skill entry (completed - add/edit/delete with proficiency sliders)
- ✅ Job posting with skill requirements (completed - with weights and thresholds)
- 🔄 Basic job matching (algorithm complete, employer UI pending)

### Phase 2: Core Features (2-3 months)
- Skill-based interview system
- AI-powered scoring
- Advanced matching algorithm
- Notifications

### Phase 3: Enhancement (2-3 months)
- Search and filtering
- Analytics dashboards
- Mobile app
- Performance optimization

### Phase 4: Scale (Ongoing)
- ML model improvements
- Additional interview types
- Video interviews
- Scale infrastructure

## License

MIT License - See [LICENSE](./LICENSE) file for details

## Contributing

(Coming soon: Contribution guidelines)

## Contact

For questions or feedback, please open an issue on GitHub.