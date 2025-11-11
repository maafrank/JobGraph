# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobGraph is a skills-based job matching platform where candidates interview once per skill (e.g., Python, Machine Learning) and get matched to multiple jobs based on their verified skill scores. The platform uses AI for resume parsing and interview evaluation, hosted entirely on AWS.

**Core Value Proposition**: Candidates take skill-specific interviews that are reused across all job applications, eliminating redundant assessments. Employers receive ranked candidates with verified skill scores.

## Architecture

### Microservices Structure

The system consists of 6 main services deployed on AWS ECS:

1. **Authentication Service** - User registration/login via AWS Cognito
2. **Profile Service** - Resume upload, AI parsing (Textract), profile management
3. **Interview Service** - Generate interviews, administer assessments, AI scoring (Bedrock)
4. **Job Service** - Job CRUD operations, skill requirement management
5. **Matching Service** - Calculate candidate-job compatibility scores
6. **Notification Service** - Email (SES) and in-app notifications

### Key Data Models

Refer to [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) for complete schema. Critical relationships:

- `users` → `candidate_profiles` (1:1) → `education`, `work_experience` (1:N)
- `skills` → `interview_templates` → `questions` (skill assessment templates)
- `interviews` → `interview_responses` (user's interview attempt and answers)
- `user_skill_scores` (derived from completed interviews, used for matching)
- `jobs` → `job_skills` (required skills with weights and minimum thresholds)
- `job_matches` (candidate-job pairs with compatibility scores)

### Matching Algorithm

The core algorithm calculates job match scores:

```python
def calculate_job_match_score(user_id, job_id):
    # Get user's skill scores from completed interviews
    # For each required skill in job:
    #   - Check user has completed interview (user_skill_scores)
    #   - Verify user_score >= minimum_score (else disqualify)
    #   - Apply skill weight to score
    # Return weighted average: Σ(skill_score[i] × weight[i]) / Σ(weight[i])
```

**Critical constraint**: Users must have completed interviews for ALL required skills in a job to be matched. Optional skills can be missing.

### Resume Parsing Flow

```
S3 Upload → EventBridge → Lambda → Textract → Parse structured data
→ Store in candidate_profiles.resume_parsed_data (JSONB)
→ Auto-fill profile fields → Generate follow_up_questions for gaps
```

### Interview Scoring Flow

```
User completes interview → interview_responses stored
→ Lambda function triggered → Bedrock evaluates responses
→ Multiple choice: exact match scoring
→ Coding: test case validation
→ Open-ended: AI evaluation with rubric
→ Calculate overall_score → Store in user_skill_scores
→ Trigger matching service to find new job matches
```

## AWS Infrastructure

See [AWS_INFRASTRUCTURE.md](AWS_INFRASTRUCTURE.md) for complete details.

**Key Services**:
- **Compute**: ECS Fargate (services), Lambda (event-driven functions)
- **Database**: RDS PostgreSQL (primary), DynamoDB (sessions), ElastiCache Redis (cache)
- **Storage**: S3 (resumes, assets)
- **AI/ML**: Textract (resume parsing), Bedrock Claude 3.5 Sonnet (interview evaluation)
- **Search**: OpenSearch (job/candidate search)
- **Auth**: Cognito (user pools)
- **Networking**: API Gateway, CloudFront (CDN), Route 53

**Infrastructure as Code**: Use AWS CDK (TypeScript) in `infrastructure/` directory.

## Development Workflow

### Environment Setup

Currently design phase - no implementation yet. When implementing:

**Backend** (Node.js or Python FastAPI):
- Each service in separate directory: `services/auth-service/`, `services/profile-service/`, etc.
- Shared utilities in `services/common/`
- Environment variables via AWS Secrets Manager (production) or `.env` (local)

**Frontend** (React + TypeScript):
- Single-page application in `frontend/`
- State management: Redux Toolkit or Zustand
- API client: Axios with React Query

**Database**:
- Local development: Docker Compose with PostgreSQL, Redis
- Apply schema: `psql -U postgres -d jobgraph < DATABASE_SCHEMA.sql`
- Migrations: Use a migration tool (e.g., node-pg-migrate, Alembic)

### Testing Strategy

**Unit Tests**: Individual functions, especially scoring algorithms
**Integration Tests**: API endpoints, database operations
**E2E Tests**: Critical user flows (resume upload → interview → matching)

**Key Areas to Test**:
- Matching algorithm correctness (various skill combinations)
- Interview scoring (different question types)
- Resume parsing edge cases (malformed PDFs, missing sections)
- Minimum threshold enforcement (candidates below threshold excluded)
- Skill weight calculations (verify weighted averages)

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

**Authentication**: JWT tokens from Cognito, passed in `Authorization: Bearer <token>` header

**Pagination**: Use `?page=1&limit=20` query params, return:
```json
{
  "data": [...],
  "pagination": {"page": 1, "limit": 20, "total": 150, "pages": 8}
}
```

**Error Responses**:
```json
{
  "error": {
    "code": "INSUFFICIENT_SKILL_SCORE",
    "message": "Your Python score (55) is below the minimum required (70)",
    "details": {"skill": "Python", "user_score": 55, "required": 70}
  }
}
```

**Key Endpoints** (see SYSTEM_DESIGN.md for full list):
- `POST /interviews/:skill_id/start` - Begin interview (locks user to skill)
- `PUT /interviews/:interview_id/submit` - Submit answers, trigger scoring
- `GET /jobs/:job_id/candidates` - Employer-only, returns ranked matches
- `POST /jobs/:job_id/contact-candidate` - Initiate contact, notify candidate

## AWS-Specific Considerations

### Lambda Function Timeouts
- Resume parsing: 5 minutes (Textract can be slow)
- Interview scoring: 2 minutes (Bedrock API calls)
- Match calculation: 10 minutes (batch process for all jobs)

### Database Connection Pooling
- ECS services use connection pooling (max 20 connections per service)
- Lambda functions use RDS Proxy to avoid connection exhaustion

### S3 Presigned URLs
- Resume uploads: Generate presigned POST URLs (10-minute expiry)
- Resume downloads: Generate presigned GET URLs (1-hour expiry, authenticated only)

### Caching Strategy (Redis)
- Cache user profiles: 1-hour TTL, invalidate on update
- Cache job details: 30-minute TTL
- Cache skill scores: 24-hour TTL, invalidate on new interview completion
- Don't cache: Match results (recalculated on-demand or scheduled)

## Security Requirements

- **Never expose raw candidate data** to employers before contact is initiated
- **Validate all file uploads**: Max 10MB, only PDF/DOCX, scan with ClamAV
- **Rate limiting**: 100 requests/minute per user (API Gateway)
- **SQL injection prevention**: Use parameterized queries exclusively
- **CORS**: Whitelist frontend domains only (`app.jobgraph.com`)
- **Secrets**: Never commit AWS credentials, use Secrets Manager or environment variables

## Cost Optimization

- **Bedrock usage**: Only evaluate open-ended questions with AI (not MCQ)
- **Textract**: Cache parsed resume data, don't re-parse on every profile view
- **RDS**: Use read replicas for heavy read operations (job search, candidate browsing)
- **Lambda**: Use appropriate memory settings (resume parser: 2GB, others: 512MB)
- **S3**: Lifecycle policies to archive old resumes to Glacier after 1 year

## Development Phases

Currently in **design phase**. See README.md for full roadmap.

**Phase 1 (MVP)**: Basic auth, profile creation, resume upload/parsing, simple job posting, basic matching without interviews
**Phase 2 (Core)**: Interview system, AI scoring, advanced matching algorithm
**Phase 3 (Enhancement)**: Search, analytics, mobile app, performance tuning
**Phase 4 (Scale)**: ML improvements, video interviews, multi-region deployment

## References

- [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Complete architecture, data models, algorithms
- [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql) - PostgreSQL schema with indexes and views
- [AWS_INFRASTRUCTURE.md](AWS_INFRASTRUCTURE.md) - AWS service configurations, networking, monitoring
