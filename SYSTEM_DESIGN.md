# JobGraph - System Design Document

## Overview
JobGraph is a skills-based job matching platform where candidates interview once per skill and get matched to multiple jobs based on their competency scores.

## Core Features
1. **Candidate Profile Management**: Resume upload, auto-fill, supplementary questions
2. **Skills-Based Interviews**: One interview per skill, reusable across jobs
3. **Job Posting**: Companies post jobs with required skills
4. **Intelligent Matching**: Score candidates against jobs based on skill interviews
5. **Candidate Ranking**: Employers view top-matched candidates

---

## System Architecture

### High-Level Architecture (AWS)

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │  Mobile App  │  │  Admin Panel │          │
│  │   (React)    │  │ (React Native)│  │   (React)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                       API Gateway (AWS)                          │
│              - Authentication & Authorization                    │
│              - Rate Limiting & Throttling                        │
│              - Request Routing                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Application Layer (ECS/Lambda)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Auth       │  │   Profile    │  │   Interview  │          │
│  │   Service    │  │   Service    │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Job        │  │   Matching   │  │   Notification│          │
│  │   Service    │  │   Service    │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                       Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   RDS        │  │  DynamoDB    │  │  ElastiCache │          │
│  │ (PostgreSQL) │  │ (NoSQL)      │  │   (Redis)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │   S3         │  │  OpenSearch  │                            │
│  │  (Files)     │  │  (Search)    │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Resume     │  │  Interview   │  │   Email      │          │
│  │   Parser     │  │  AI Engine   │  │   (SES)      │          │
│  │  (Textract)  │  │  (Bedrock)   │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### 1. User (Candidate)
```json
{
  "user_id": "uuid",
  "email": "string",
  "password_hash": "string",
  "first_name": "string",
  "last_name": "string",
  "phone": "string",
  "location": {
    "city": "string",
    "state": "string",
    "country": "string"
  },
  "profile": {
    "headline": "string",
    "summary": "string",
    "years_experience": "integer",
    "education": [
      {
        "degree": "string",
        "field": "string",
        "institution": "string",
        "graduation_year": "integer"
      }
    ],
    "work_experience": [
      {
        "title": "string",
        "company": "string",
        "start_date": "date",
        "end_date": "date",
        "description": "string"
      }
    ]
  },
  "resume_url": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### 2. Company
```json
{
  "company_id": "uuid",
  "name": "string",
  "description": "string",
  "website": "string",
  "logo_url": "string",
  "industry": "string",
  "size": "string",
  "location": {
    "city": "string",
    "state": "string",
    "country": "string"
  },
  "verified": "boolean",
  "created_at": "timestamp"
}
```

### 3. Skill
```json
{
  "skill_id": "uuid",
  "name": "string",
  "category": "string", // e.g., "programming", "data_science", "finance"
  "description": "string",
  "interview_template_id": "uuid",
  "active": "boolean"
}
```

### 4. Job Posting
```json
{
  "job_id": "uuid",
  "company_id": "uuid",
  "title": "string",
  "description": "string",
  "requirements": "string",
  "location": {
    "city": "string",
    "state": "string",
    "remote": "boolean"
  },
  "salary_range": {
    "min": "integer",
    "max": "integer",
    "currency": "string"
  },
  "required_skills": [
    {
      "skill_id": "uuid",
      "weight": "float", // 0.0 - 1.0, importance of this skill
      "minimum_score": "float" // 0-100, minimum threshold
    }
  ],
  "employment_type": "string", // "full-time", "part-time", "contract"
  "status": "string", // "active", "closed", "draft"
  "created_at": "timestamp",
  "expires_at": "timestamp"
}
```

### 5. Interview
```json
{
  "interview_id": "uuid",
  "user_id": "uuid",
  "skill_id": "uuid",
  "status": "string", // "scheduled", "in_progress", "completed", "expired"
  "questions": [
    {
      "question_id": "uuid",
      "question_text": "string",
      "question_type": "string", // "multiple_choice", "coding", "open_ended"
      "answer": "string",
      "score": "float", // 0-100
      "time_spent_seconds": "integer"
    }
  ],
  "overall_score": "float", // 0-100
  "ai_evaluation": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "confidence_level": "float"
  },
  "started_at": "timestamp",
  "completed_at": "timestamp",
  "valid_until": "timestamp" // interviews expire after X months
}
```

### 6. User-Skill Score
```json
{
  "user_skill_id": "uuid",
  "user_id": "uuid",
  "skill_id": "uuid",
  "interview_id": "uuid",
  "score": "float", // 0-100
  "percentile": "float", // 0-100, compared to all users
  "created_at": "timestamp",
  "expires_at": "timestamp"
}
```

### 7. Job Match
```json
{
  "match_id": "uuid",
  "job_id": "uuid",
  "user_id": "uuid",
  "overall_score": "float", // 0-100, weighted average of skill scores
  "skill_breakdown": [
    {
      "skill_id": "uuid",
      "user_score": "float",
      "required_score": "float",
      "weight": "float"
    }
  ],
  "match_rank": "integer", // rank among all candidates for this job
  "status": "string", // "matched", "viewed", "contacted", "rejected"
  "created_at": "timestamp"
}
```

### 8. Follow-up Questions
```json
{
  "question_id": "uuid",
  "user_id": "uuid",
  "question_text": "string",
  "question_type": "string",
  "triggered_by": "string", // "resume_gap", "skill_clarification", etc.
  "answer": "string",
  "answered_at": "timestamp"
}
```

---

## Core Services

### 1. **Authentication Service**
- User registration/login (Cognito)
- JWT token management
- Role-based access control (Candidate, Employer, Admin)

### 2. **Profile Service**
**Responsibilities:**
- Resume upload to S3
- Resume parsing using AWS Textract
- Auto-fill profile from parsed data
- Identify gaps and generate follow-up questions
- Profile CRUD operations

**Resume Parsing Flow:**
```
Resume Upload → S3 → Trigger Lambda → Textract →
Parse Results → Extract structured data →
Store in DB → Generate follow-up questions
```

### 3. **Interview Service**
**Responsibilities:**
- Generate skill-based interviews
- Administer interviews (web-based assessment)
- Score responses using AI (AWS Bedrock)
- Store interview results
- Validate interview expiration

**Interview Generation:**
- Question bank per skill stored in database
- Mix of question types (MCQ, coding challenges, open-ended)
- Adaptive difficulty based on initial responses

**Scoring Algorithm:**
```python
# Pseudocode
def score_interview(interview):
    scores = []
    for question in interview.questions:
        if question.type == "multiple_choice":
            score = exact_match(question.answer, question.correct_answer)
        elif question.type == "coding":
            score = run_test_cases(question.answer)
        elif question.type == "open_ended":
            score = ai_evaluate_response(question.answer, question.rubric)
        scores.append(score * question.weight)

    return weighted_average(scores)
```

### 4. **Job Service**
**Responsibilities:**
- Job posting CRUD
- Skill requirement configuration
- Job search and filtering
- Job status management

### 5. **Matching Service**
**Responsibilities:**
- Calculate job-candidate compatibility scores
- Rank candidates for each job
- Trigger notifications for high matches

**Matching Algorithm:**
```python
# Pseudocode
def calculate_job_match_score(user_id, job_id):
    job = get_job(job_id)
    user_skills = get_user_skill_scores(user_id)

    total_score = 0
    skill_breakdown = []

    for required_skill in job.required_skills:
        user_skill_score = user_skills.get(required_skill.skill_id, 0)

        # Check minimum threshold
        if user_skill_score < required_skill.minimum_score:
            return 0  # Disqualified

        # Weighted contribution
        weighted_score = user_skill_score * required_skill.weight
        total_score += weighted_score

        skill_breakdown.append({
            "skill_id": required_skill.skill_id,
            "user_score": user_skill_score,
            "required_score": required_skill.minimum_score,
            "weight": required_skill.weight
        })

    # Normalize to 0-100
    normalized_score = total_score / sum(skill.weight for skill in job.required_skills)

    return {
        "overall_score": normalized_score,
        "skill_breakdown": skill_breakdown
    }
```

### 6. **Notification Service**
**Responsibilities:**
- Email notifications (SES)
- In-app notifications
- Alert candidates of new matching jobs
- Alert employers of new matching candidates

---

## API Endpoints

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/logout
```

### User Profile
```
GET    /api/v1/users/me
PUT    /api/v1/users/me
POST   /api/v1/users/me/resume
GET    /api/v1/users/me/resume
POST   /api/v1/users/me/follow-up-questions
GET    /api/v1/users/me/matches
```

### Skills & Interviews
```
GET    /api/v1/skills
GET    /api/v1/skills/:skill_id
GET    /api/v1/users/me/interviews
POST   /api/v1/interviews/:skill_id/start
PUT    /api/v1/interviews/:interview_id/submit
GET    /api/v1/interviews/:interview_id/results
GET    /api/v1/users/me/skill-scores
```

### Jobs
```
GET    /api/v1/jobs
GET    /api/v1/jobs/:job_id
POST   /api/v1/jobs (employer only)
PUT    /api/v1/jobs/:job_id (employer only)
DELETE /api/v1/jobs/:job_id (employer only)
GET    /api/v1/jobs/:job_id/candidates (employer only)
POST   /api/v1/jobs/:job_id/contact-candidate (employer only)
```

### Company
```
GET    /api/v1/companies/:company_id
POST   /api/v1/companies (employer only)
PUT    /api/v1/companies/:company_id (employer only)
```

---

## Technology Stack

### Frontend
- **Web App**: React + TypeScript, Vite, TailwindCSS
- **Mobile App**: React Native
- **State Management**: Redux Toolkit or Zustand
- **API Client**: Axios or React Query

### Backend
- **API Framework**: Node.js (Express/Fastify) or Python (FastAPI)
- **Container Orchestration**: AWS ECS with Fargate
- **Serverless Functions**: AWS Lambda (for event-driven tasks)
- **API Gateway**: AWS API Gateway

### Database
- **Primary DB**: Amazon RDS (PostgreSQL) - structured data
- **Cache**: Amazon ElastiCache (Redis) - session, frequently accessed data
- **Search**: Amazon OpenSearch - job search, candidate search
- **File Storage**: Amazon S3 - resumes, company logos

### AI/ML
- **Resume Parsing**: AWS Textract
- **Interview Evaluation**: AWS Bedrock (Claude or other LLMs)
- **Embeddings**: Amazon Bedrock (for semantic search)

### Infrastructure
- **Infrastructure as Code**: AWS CDK or Terraform
- **CI/CD**: GitHub Actions → AWS CodePipeline → ECS
- **Monitoring**: CloudWatch, X-Ray
- **Logging**: CloudWatch Logs

### Authentication
- **Auth Provider**: AWS Cognito

### Communication
- **Email**: Amazon SES
- **Push Notifications**: AWS SNS

---

## Workflow Diagrams

### Candidate Onboarding Flow
```
1. User signs up
2. User uploads resume
3. System parses resume (Textract)
4. System auto-fills profile
5. System generates follow-up questions
6. User answers follow-up questions
7. User selects skills to interview for
8. User completes skill interviews
9. System calculates skill scores
10. System matches user to jobs
11. User receives job recommendations
```

### Employer Flow
```
1. Company signs up
2. Company creates profile
3. Company posts job with required skills
4. System matches job to candidates
5. System ranks candidates by score
6. Employer views top candidates
7. Employer contacts candidates
```

### Interview Flow
```
1. User selects skill to interview for
2. System generates interview questions
3. User completes interview
4. System scores responses
   - MCQ: automated scoring
   - Coding: test case validation
   - Open-ended: AI evaluation
5. System stores skill score
6. Skill score used for all job matches
7. Interview valid for X months (e.g., 6 months)
```

---

## Scoring & Ranking

### Individual Skill Score
- Range: 0-100
- Based on interview performance
- Includes percentile ranking against all users
- Expires after 6-12 months (configurable)

### Job Match Score
```
match_score = Σ(user_skill_score[i] × skill_weight[i]) / Σ(skill_weight[i])

Where:
- user_skill_score[i]: User's score for skill i (0-100)
- skill_weight[i]: Importance weight of skill i for this job (0-1)
- Sum is over all required skills for the job
```

### Candidate Ranking
- Candidates ranked by match_score for each job
- Minimum thresholds can disqualify candidates
- Top N candidates shown to employer (e.g., top 50)

---

## Security & Privacy

### Data Protection
- Encrypt data at rest (S3, RDS encryption)
- Encrypt data in transit (TLS/HTTPS)
- PII data encryption
- Regular security audits

### Access Control
- Role-based access control (RBAC)
- Candidates can only see their own data
- Employers can only see matched candidates
- Admin has full access

### Privacy
- Candidates control profile visibility
- Anonymize candidate data until employer contact
- GDPR/CCPA compliance
- Right to be forgotten

---

## Scalability Considerations

### Database
- Read replicas for read-heavy operations
- Database sharding by user_id/company_id
- Caching layer (Redis) for hot data

### Compute
- Auto-scaling ECS services
- Lambda for burst workloads
- CDN (CloudFront) for static assets

### Search
- OpenSearch for full-text search
- Elasticsearch indices for jobs and candidates
- Faceted search with filters

---

## Future Enhancements

1. **Video Interviews**: Record video responses for behavioral questions
2. **Skill Endorsements**: Peer/employer endorsements for skills
3. **Interview Scheduling**: Calendar integration for live interviews
4. **Analytics Dashboard**: Insights for employers and candidates
5. **Referral System**: Candidate referral bonuses
6. **AI Resume Builder**: Help candidates optimize resumes
7. **Salary Insights**: Market salary data for skills/locations
8. **Interview Preparation**: Practice interviews with AI feedback

---

## Development Phases

### Phase 1: MVP (3-4 months)
- User authentication
- Basic profile creation
- Resume upload & parsing
- Manual skill assessment (no interviews yet)
- Basic job posting
- Simple matching algorithm

### Phase 2: Core Features (2-3 months)
- Skill-based interviews
- AI-powered scoring
- Advanced matching algorithm
- Candidate ranking
- Email notifications

### Phase 3: Enhancement (2-3 months)
- Search & filtering
- Analytics dashboard
- Mobile app
- Advanced privacy controls
- Performance optimization

### Phase 4: Scale & Polish (Ongoing)
- A/B testing
- ML model improvements
- User feedback integration
- Scale infrastructure
