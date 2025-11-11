# JobGraph - Execution Plan

This document outlines the step-by-step implementation plan for building JobGraph, ordered to minimize dependencies and allow for incremental testing.

---

## Phase 0: Foundation (Week 1-2)

### 0.1 Repository Structure
- [ ] Create monorepo structure
  ```
  /backend
    /services
      /auth-service
      /profile-service
      /interview-service
      /job-service
      /matching-service
      /notification-service
    /common
      /database
      /utils
      /types
  /frontend
  /infrastructure
  /scripts
  ```
- [ ] Set up `.env.example` files for each service
- [ ] Create Docker Compose for local development (PostgreSQL, Redis)
- [ ] Initialize Git with proper `.gitignore`

### 0.2 Database Setup
- [ ] Set up local PostgreSQL database
- [ ] Apply `DATABASE_SCHEMA.sql`
- [ ] Set up migration tool (node-pg-migrate or Alembic)
- [ ] Create seed data script for development
  - Sample skills (Python, Machine Learning, SQL, etc.)
  - Sample interview templates
  - Sample questions

### 0.3 Development Tools
- [ ] Configure TypeScript/ESLint (backend) or Python/Ruff (backend)
- [ ] Set up testing framework (Jest/Vitest or pytest)
- [ ] Configure pre-commit hooks (Husky)
- [ ] Set up API documentation (Swagger/OpenAPI)

---

## Phase 1: MVP - Core Infrastructure (Week 3-6)

### 1.1 Authentication Service
**Goal**: Users can register and log in

- [ ] **Local Auth Implementation** (start simple, add Cognito later)
  - [ ] User registration endpoint (`POST /api/v1/auth/register`)
  - [ ] Password hashing (bcrypt)
  - [ ] Email validation
  - [ ] User login endpoint (`POST /api/v1/auth/login`)
  - [ ] JWT token generation and validation
  - [ ] Refresh token mechanism
  - [ ] Password reset flow (email with reset token)

- [ ] **Middleware**
  - [ ] Authentication middleware (verify JWT)
  - [ ] Role-based authorization middleware (candidate/employer/admin)

- [ ] **Testing**
  - [ ] Unit tests for token generation/validation
  - [ ] Integration tests for registration/login flows
  - [ ] Test password reset flow

**Deliverable**: Users can register, login, and receive JWT tokens

---

### 1.2 Profile Service - Basic Profiles
**Goal**: Users can create candidate or company profiles

#### 1.2.1 Candidate Profiles (Week 4)
- [ ] **API Endpoints**
  - [ ] `GET /api/v1/users/me` - Get current user profile
  - [ ] `PUT /api/v1/users/me` - Update profile
  - [ ] `POST /api/v1/users/me/education` - Add education
  - [ ] `POST /api/v1/users/me/experience` - Add work experience
  - [ ] `DELETE /api/v1/users/me/education/:id` - Remove education
  - [ ] `DELETE /api/v1/users/me/experience/:id` - Remove experience

- [ ] **Database Operations**
  - [ ] CRUD for `candidate_profiles`
  - [ ] CRUD for `education`
  - [ ] CRUD for `work_experience`

- [ ] **Validation**
  - [ ] Input validation (required fields, formats)
  - [ ] Date validation (graduation year, employment dates)

- [ ] **Testing**
  - [ ] Unit tests for profile business logic
  - [ ] Integration tests for all endpoints

#### 1.2.2 Company Profiles (Week 4)
- [ ] **API Endpoints**
  - [ ] `POST /api/v1/companies` - Create company
  - [ ] `GET /api/v1/companies/:id` - Get company details
  - [ ] `PUT /api/v1/companies/:id` - Update company
  - [ ] `POST /api/v1/companies/:id/users` - Add user to company

- [ ] **Database Operations**
  - [ ] CRUD for `companies`
  - [ ] Link users to companies (`company_users`)

- [ ] **Testing**
  - [ ] Integration tests for company operations

**Deliverable**: Users can create and manage profiles

---

### 1.3 File Upload - Resume Upload (Week 5)
**Goal**: Candidates can upload resumes to S3

- [ ] **S3 Setup**
  - [ ] Create S3 bucket (`jobgraph-resumes-dev`)
  - [ ] Configure CORS for direct uploads
  - [ ] Set up bucket policies (private access)

- [ ] **API Endpoints**
  - [ ] `POST /api/v1/users/me/resume/upload-url` - Generate presigned URL
  - [ ] `POST /api/v1/users/me/resume/confirm` - Confirm upload complete
  - [ ] `GET /api/v1/users/me/resume` - Get resume download URL (presigned)

- [ ] **Implementation**
  - [ ] Generate presigned POST URLs (10-minute expiry)
  - [ ] File validation (max 10MB, PDF/DOCX only)
  - [ ] Store resume URL in `candidate_profiles.resume_url`
  - [ ] Frontend: Direct browser upload to S3

- [ ] **Testing**
  - [ ] Test presigned URL generation
  - [ ] Test file upload flow (use Postman or curl)
  - [ ] Test file type validation

**Deliverable**: Users can upload resumes that are stored in S3

---

### 1.4 Resume Parsing - Basic (Week 5-6)
**Goal**: Extract text from resumes

**Start Simple**: Use a basic text extraction library before AWS Textract

- [ ] **Local Text Extraction**
  - [ ] Install pdf-parse (Node.js) or PyPDF2 (Python)
  - [ ] Create Lambda function or background job
  - [ ] Extract raw text from PDF

- [ ] **S3 Trigger**
  - [ ] Set up S3 event notification (on object created)
  - [ ] Trigger Lambda or API endpoint
  - [ ] Store raw text in `candidate_profiles.resume_parsed_data`

- [ ] **Basic Parsing Logic**
  - [ ] Extract email, phone (regex patterns)
  - [ ] Extract education sections (basic pattern matching)
  - [ ] Extract work experience sections
  - [ ] Store structured data as JSONB

- [ ] **Auto-fill Profile**
  - [ ] After parsing, update profile fields if empty
  - [ ] Generate follow-up questions for missing data
  - [ ] Store questions in `follow_up_questions` table

- [ ] **Testing**
  - [ ] Test with sample resumes (various formats)
  - [ ] Verify extracted data accuracy
  - [ ] Test auto-fill logic

**Note**: AWS Textract integration can be added in Phase 2 for better accuracy

**Deliverable**: Resumes are parsed and profiles auto-filled with basic information

---

### 1.5 Skills Management (Week 6)
**Goal**: Manage skills catalog

- [ ] **API Endpoints**
  - [ ] `GET /api/v1/skills` - List all skills (with pagination, filtering by category)
  - [ ] `GET /api/v1/skills/:id` - Get skill details
  - [ ] `POST /api/v1/skills` (admin only) - Create new skill
  - [ ] `PUT /api/v1/skills/:id` (admin only) - Update skill

- [ ] **Seed Data**
  - [ ] Populate initial skills (Python, JavaScript, ML, Data Engineering, etc.)
  - [ ] Categorize skills (programming, data_science, finance, etc.)

- [ ] **Testing**
  - [ ] Test skill CRUD operations
  - [ ] Test filtering and pagination

**Deliverable**: Skills catalog is available and manageable

---

### 1.6 Job Service - Basic Jobs (Week 7)
**Goal**: Companies can post jobs with skill requirements

- [ ] **API Endpoints**
  - [ ] `POST /api/v1/jobs` - Create job (employer only)
  - [ ] `GET /api/v1/jobs` - List jobs (public, with filters)
  - [ ] `GET /api/v1/jobs/:id` - Get job details
  - [ ] `PUT /api/v1/jobs/:id` - Update job (employer only)
  - [ ] `DELETE /api/v1/jobs/:id` - Delete job (employer only)
  - [ ] `POST /api/v1/jobs/:id/skills` - Add required skill to job
  - [ ] `DELETE /api/v1/jobs/:id/skills/:skill_id` - Remove skill from job

- [ ] **Database Operations**
  - [ ] CRUD for `jobs`
  - [ ] CRUD for `job_skills` (with weights and minimum scores)

- [ ] **Validation**
  - [ ] Verify user is authorized (company member)
  - [ ] Validate skill weights sum to reasonable value
  - [ ] Validate minimum scores (0-100 range)

- [ ] **Testing**
  - [ ] Test job creation with multiple skills
  - [ ] Test authorization (only company users can post)
  - [ ] Test job listing with filters

**Deliverable**: Employers can create jobs with required skills

---

### 1.7 Simple Matching - Manual Scores (Week 8)
**Goal**: Manual skill scoring and basic matching

**Note**: This is a simplified version without interviews. Users manually enter skill scores.

- [ ] **Manual Skill Scores**
  - [ ] `POST /api/v1/users/me/skills` - User adds skill with self-reported score
  - [ ] `GET /api/v1/users/me/skills` - List user's skills
  - [ ] `PUT /api/v1/users/me/skills/:skill_id` - Update skill score
  - [ ] Store in `user_skill_scores` (set expiry far in future)

- [ ] **Basic Matching Algorithm**
  - [ ] Implement matching logic from SYSTEM_DESIGN.md
  - [ ] For each job, find users with all required skills
  - [ ] Calculate weighted average score
  - [ ] Check minimum thresholds
  - [ ] Store results in `job_matches`

- [ ] **API Endpoints**
  - [ ] `GET /api/v1/users/me/matches` - Get jobs matched to user
  - [ ] `GET /api/v1/jobs/:job_id/candidates` (employer) - Get matched candidates
  - [ ] `POST /api/v1/matching/calculate` (admin) - Trigger match calculation

- [ ] **Testing**
  - [ ] Unit tests for matching algorithm
  - [ ] Test various scenarios (multi-skill jobs, threshold enforcement)
  - [ ] Test weighted score calculation

**Deliverable**: Basic matching works with manual skill scores

---

### 1.8 Frontend - MVP UI (Week 9-10)
**Goal**: Basic functional UI

#### 1.8.1 Setup & Layout
- [ ] Initialize React + TypeScript + Vite
- [ ] Install TailwindCSS
- [ ] Set up React Router
- [ ] Create layout components (Header, Sidebar, Footer)
- [ ] Set up Axios + React Query

#### 1.8.2 Authentication Pages
- [ ] Login page
- [ ] Registration page (candidate/employer selection)
- [ ] Password reset page
- [ ] Protected route wrapper

#### 1.8.3 Candidate Pages
- [ ] Profile page (view/edit)
- [ ] Resume upload component
- [ ] Education/experience management
- [ ] Skills management (manual entry for MVP)
- [ ] Job matches page (list of matched jobs)

#### 1.8.4 Employer Pages
- [ ] Company profile page
- [ ] Job posting form
- [ ] Job management page (list, edit, delete)
- [ ] Candidate matches page (ranked candidates for a job)

#### 1.8.5 Public Pages
- [ ] Home/landing page
- [ ] Job search page (browse all active jobs)
- [ ] Job details page

**Deliverable**: Functional UI for core MVP features

---

### 1.9 Testing & Bug Fixes (Week 11)
- [ ] End-to-end testing of complete user flows
- [ ] Fix critical bugs
- [ ] Performance testing
- [ ] Security audit (basic)

**Deliverable**: Stable MVP ready for Phase 2

---

## Phase 2: Interview System (Week 12-18)

### 2.1 Interview Templates & Questions (Week 12)
**Goal**: Create interview structure

- [ ] **Admin Interface** (can be simple API-based initially)
  - [ ] Create interview templates for skills
  - [ ] Add questions to templates
  - [ ] Define question types (MCQ, coding, open-ended)

- [ ] **Seed Interview Data**
  - [ ] Create templates for top 10 skills
  - [ ] Populate with 10-15 questions each
  - [ ] Mix of difficulty levels

**Deliverable**: Interview templates and questions in database

---

### 2.2 Interview Service - Take Interviews (Week 13-14)

#### 2.2.1 Interview Session Management
- [ ] **API Endpoints**
  - [ ] `POST /api/v1/interviews/:skill_id/start` - Start interview
  - [ ] `GET /api/v1/interviews/:interview_id` - Get interview (questions + progress)
  - [ ] `PUT /api/v1/interviews/:interview_id/answer` - Submit answer to question
  - [ ] `POST /api/v1/interviews/:interview_id/submit` - Complete interview
  - [ ] `GET /api/v1/interviews/:interview_id/results` - Get results

- [ ] **Business Logic**
  - [ ] Create interview record (status: in_progress)
  - [ ] Prevent multiple active interviews per skill per user
  - [ ] Load questions from template
  - [ ] Track time spent per question
  - [ ] Store answers in `interview_responses`

#### 2.2.2 Frontend - Interview UI
- [ ] Interview start page (skill selection)
- [ ] Question display component
  - [ ] Multiple choice renderer
  - [ ] Code editor for coding questions (Monaco Editor)
  - [ ] Text area for open-ended questions
- [ ] Timer display
- [ ] Progress indicator (question X of Y)
- [ ] Submit confirmation modal

**Deliverable**: Users can take skill interviews

---

### 2.3 Interview Scoring - Automated (Week 15)

#### 2.3.1 Multiple Choice & Coding Scoring
- [ ] **Multiple Choice**
  - [ ] Exact match scoring (correct = 100, incorrect = 0)
  - [ ] Partial credit for "select all that apply" types

- [ ] **Coding Questions**
  - [ ] Set up code execution sandbox (use Judge0 API or AWS Lambda)
  - [ ] Run test cases against submitted code
  - [ ] Score based on passing test cases (e.g., 3/5 = 60 points)
  - [ ] Add timeout limits (30 seconds per test case)

- [ ] **Calculate Overall Score**
  - [ ] Weighted average based on question points
  - [ ] Store in `interviews.overall_score`

- [ ] **Testing**
  - [ ] Test MCQ scoring
  - [ ] Test code execution with various languages
  - [ ] Test timeout handling

**Deliverable**: Automated scoring for MCQ and coding questions

---

### 2.4 AI-Powered Scoring - Open-Ended (Week 16)

#### 2.4.1 AWS Bedrock Integration
- [ ] Set up AWS Bedrock access (Claude 3.5 Sonnet)
- [ ] Create evaluation prompt template
  ```
  Evaluate this answer to a [skill] interview question:

  Question: {question_text}
  Expected Answer Rubric: {rubric}
  Candidate's Answer: {candidate_answer}

  Provide:
  1. Score (0-100)
  2. Brief reasoning
  3. Confidence level (0-1)
  ```

- [ ] **Lambda Function** (or background job)
  - [ ] Triggered when interview submitted
  - [ ] For each open-ended question, call Bedrock
  - [ ] Parse response and extract score
  - [ ] Store feedback in `interview_responses.ai_feedback`

- [ ] **Evaluation Record**
  - [ ] Store overall evaluation in `interview_evaluations`
  - [ ] Extract strengths/weaknesses from AI response
  - [ ] Calculate confidence level

- [ ] **Testing**
  - [ ] Test with sample answers (good, average, poor)
  - [ ] Verify score consistency
  - [ ] Test error handling (API failures)

**Deliverable**: AI evaluates open-ended responses

---

### 2.5 Interview Results & Skill Scores (Week 17)

- [ ] **Calculate Final Scores**
  - [ ] After all questions scored, calculate `overall_score`
  - [ ] Set `interviews.status = 'completed'`
  - [ ] Set `interviews.valid_until` (6 months from completion)

- [ ] **Update User Skill Scores**
  - [ ] Insert/update `user_skill_scores`
  - [ ] Calculate percentile (compare to all users who took this interview)
  - [ ] Set expiry date

- [ ] **Trigger Matching**
  - [ ] After skill score updated, recalculate job matches
  - [ ] Update `job_matches` table
  - [ ] Send notification if new high-quality matches found

- [ ] **Frontend - Results Page**
  - [ ] Display overall score
  - [ ] Show breakdown by question
  - [ ] Display AI feedback for open-ended questions
  - [ ] Show percentile ranking
  - [ ] Link to matched jobs

**Deliverable**: Complete interview flow with skill score generation

---

### 2.6 Advanced Matching with Real Scores (Week 18)

- [ ] **Replace Manual Scores**
  - [ ] Update matching algorithm to use interview-based scores only
  - [ ] Deprecate manual skill entry

- [ ] **Scheduled Matching Job**
  - [ ] Create cron job (Lambda + EventBridge)
  - [ ] Run daily: calculate matches for all active jobs
  - [ ] Rank candidates and update `job_matches.match_rank`

- [ ] **Match Notifications**
  - [ ] When new high-quality match found (score > 80), notify candidate
  - [ ] When new qualified candidate found, notify employer

- [ ] **Testing**
  - [ ] Test end-to-end: Interview → Score → Match → Notification
  - [ ] Verify match quality with real interview scores

**Deliverable**: Full interview-to-matching pipeline working

---

## Phase 3: Enhancement & Polish (Week 19-26)

### 3.1 Search & Filtering (Week 19-20)

#### 3.1.1 Job Search
- [ ] **OpenSearch Setup**
  - [ ] Create OpenSearch domain
  - [ ] Create `jobs_index`
  - [ ] Index job data on creation/update

- [ ] **Search API**
  - [ ] `GET /api/v1/jobs/search?q=machine+learning&location=NYC&remote=true`
  - [ ] Full-text search on title, description
  - [ ] Faceted filtering (location, salary, remote, employment_type)
  - [ ] Autocomplete for skills

- [ ] **Frontend**
  - [ ] Search bar with autocomplete
  - [ ] Filters sidebar
  - [ ] Search results page

#### 3.1.2 Candidate Search (Employer)
- [ ] Index anonymized candidate data
- [ ] Search by skills, experience level
- [ ] (Optional: May not be needed if matching works well)

**Deliverable**: Full-text job search with filters

---

### 3.2 Notifications & Emails (Week 21)

#### 3.2.1 AWS SES Setup
- [ ] Configure SES (verify domain, set up DKIM/SPF)
- [ ] Create email templates
  - [ ] Welcome email
  - [ ] Email verification
  - [ ] Password reset
  - [ ] New match notification
  - [ ] Employer contact notification
  - [ ] Interview reminder

#### 3.2.2 Notification Service
- [ ] In-app notifications (`notifications` table)
- [ ] Email sending via SES
- [ ] Mark as read functionality
- [ ] Notification preferences

#### 3.2.3 Frontend
- [ ] Notification bell icon with count
- [ ] Notifications dropdown
- [ ] Notification settings page

**Deliverable**: Email and in-app notifications

---

### 3.3 Analytics Dashboard (Week 22)

#### 3.3.1 Candidate Analytics
- [ ] Skill scores over time
- [ ] Interview completion rate
- [ ] Match quality metrics
- [ ] Profile views (if employers can view)

#### 3.3.2 Employer Analytics
- [ ] Job posting performance (views, matches)
- [ ] Candidate quality distribution
- [ ] Time to hire metrics

#### 3.3.3 Admin Analytics
- [ ] Platform usage stats
- [ ] Most popular skills
- [ ] Interview completion rates
- [ ] Match success rates

**Deliverable**: Analytics dashboards for all user types

---

### 3.4 Enhanced Resume Parsing - AWS Textract (Week 23)

- [ ] Replace basic PDF parsing with AWS Textract
- [ ] Use Textract's table and form detection
- [ ] Improve extraction accuracy for:
  - [ ] Education (degree, institution, dates)
  - [ ] Work experience (title, company, dates, descriptions)
  - [ ] Skills mentioned in resume
- [ ] Use extracted skills to suggest interviews
- [ ] Better follow-up question generation (detect gaps in work history)

**Deliverable**: Improved resume parsing accuracy

---

### 3.5 Profile Enhancements (Week 24)

- [ ] Profile picture upload (S3)
- [ ] LinkedIn import (OAuth integration)
- [ ] Portfolio links
- [ ] Certification/awards section
- [ ] Profile completion percentage
- [ ] Profile visibility settings (public/private/anonymous)

**Deliverable**: Richer candidate profiles

---

### 3.6 Employer Features (Week 25)

- [ ] **Candidate Contact**
  - [ ] `POST /api/v1/jobs/:job_id/contact-candidate` - Initiate contact
  - [ ] Send email to candidate
  - [ ] Reveal candidate identity to employer (if anonymous)
  - [ ] Track contact status in `job_matches`

- [ ] **Shortlisting**
  - [ ] Save/bookmark candidates
  - [ ] Move candidates through pipeline (contacted, interviewing, offered, hired)

- [ ] **Team Management**
  - [ ] Invite team members to company
  - [ ] Role management (admin, recruiter, hiring manager)

**Deliverable**: Employer workflow tools

---

### 3.7 Mobile App (Week 26+)
- [ ] React Native setup
- [ ] Core features:
  - [ ] Authentication
  - [ ] Take interviews (mobile-friendly UI)
  - [ ] View matches
  - [ ] Notifications
- [ ] (Deprioritize advanced features for MVP)

**Deliverable**: Mobile app with core functionality

---

## Phase 4: AWS Infrastructure & Production (Week 27-30)

### 4.1 Infrastructure as Code (Week 27)
- [ ] AWS CDK project setup
- [ ] Define all AWS resources:
  - [ ] VPC, subnets, security groups
  - [ ] RDS PostgreSQL (multi-AZ)
  - [ ] ElastiCache Redis
  - [ ] S3 buckets
  - [ ] ECS clusters and services
  - [ ] Lambda functions
  - [ ] API Gateway
  - [ ] Cognito user pools
  - [ ] OpenSearch
  - [ ] CloudWatch alarms
- [ ] Deploy to dev environment
- [ ] Deploy to staging environment

**Deliverable**: Complete infrastructure defined as code

---

### 4.2 Migration to AWS Services (Week 28)

#### 4.2.1 Replace Local Auth with Cognito
- [ ] Set up Cognito user pools
- [ ] Migrate authentication to Cognito
- [ ] Update frontend to use Cognito SDK

#### 4.2.2 Database Migration
- [ ] Set up RDS PostgreSQL
- [ ] Migrate schema
- [ ] Set up read replicas
- [ ] Configure backups

#### 4.2.3 Caching with ElastiCache
- [ ] Set up Redis cluster
- [ ] Implement caching layer
- [ ] Test cache invalidation

**Deliverable**: Running on AWS services

---

### 4.3 CI/CD Pipeline (Week 29)
- [ ] GitHub Actions workflows
  - [ ] Lint and test on PR
  - [ ] Build Docker images
  - [ ] Push to ECR
  - [ ] Deploy to staging on merge to `develop`
  - [ ] Deploy to production on merge to `main` (with approval)
- [ ] Database migration automation
- [ ] Rollback strategy

**Deliverable**: Automated deployment pipeline

---

### 4.4 Monitoring & Observability (Week 30)

#### 4.4.1 Logging
- [ ] CloudWatch Logs for all services
- [ ] Structured logging (JSON)
- [ ] Log aggregation

#### 4.4.2 Metrics
- [ ] Custom CloudWatch metrics
  - [ ] API response times
  - [ ] Interview completion rates
  - [ ] Match calculation times
- [ ] CloudWatch dashboards

#### 4.4.3 Alerting
- [ ] Set up SNS topics
- [ ] Configure alarms:
  - [ ] High error rates
  - [ ] High latency
  - [ ] Database connection issues
  - [ ] Lambda failures
- [ ] PagerDuty integration (optional)

#### 4.4.4 Tracing
- [ ] AWS X-Ray integration
- [ ] Distributed tracing across services

**Deliverable**: Production monitoring and alerting

---

### 4.5 Security Hardening (Week 30)

- [ ] **Web Application Firewall**
  - [ ] Set up AWS WAF
  - [ ] Rate limiting rules
  - [ ] SQL injection protection
  - [ ] XSS protection

- [ ] **Secrets Management**
  - [ ] Move all secrets to AWS Secrets Manager
  - [ ] Automatic rotation for database passwords
  - [ ] Remove hardcoded secrets

- [ ] **Compliance**
  - [ ] GDPR compliance audit
  - [ ] Data retention policies
  - [ ] Right to be forgotten implementation
  - [ ] Privacy policy and terms of service

- [ ] **Security Audit**
  - [ ] Penetration testing
  - [ ] Vulnerability scanning (AWS Inspector)
  - [ ] Dependency audit

**Deliverable**: Production-ready secure platform

---

### 4.6 Performance Optimization (Week 30)

- [ ] **Database**
  - [ ] Query optimization (add indexes)
  - [ ] Connection pooling tuning
  - [ ] Read replica usage for queries

- [ ] **Caching**
  - [ ] Redis caching strategy
  - [ ] CloudFront CDN for static assets
  - [ ] API response caching

- [ ] **Load Testing**
  - [ ] Use Artillery or k6
  - [ ] Test with 1000+ concurrent users
  - [ ] Identify bottlenecks
  - [ ] Scale ECS services

**Deliverable**: Optimized for production load

---

## Phase 5: Launch & Scale (Week 31+)

### 5.1 Beta Launch
- [ ] Invite beta users (50-100)
- [ ] Collect feedback
- [ ] Fix critical issues
- [ ] Iterate on UX

### 5.2 Public Launch
- [ ] Marketing website
- [ ] Launch announcement
- [ ] Monitor performance
- [ ] User onboarding flow optimization

### 5.3 Post-Launch Features
- [ ] Video interviews
- [ ] AI-generated resume builder
- [ ] Referral program
- [ ] Advanced analytics
- [ ] Salary insights
- [ ] Skill endorsements

---

## Key Dependencies & Critical Path

### Critical Path (Must be done in order):
1. Auth → Profiles → File Upload → Jobs → Matching → Frontend MVP
2. Interview Templates → Interview Taking → Scoring → Skill Scores → Matching v2
3. Infrastructure → AWS Migration → CI/CD → Production Launch

### Parallelizable Work:
- Frontend can be built alongside backend (use mocked data initially)
- Resume parsing enhancement can happen after MVP
- Analytics/notifications can be built after core features stable
- Mobile app can be developed after web app is stable

---

## Success Metrics per Phase

### Phase 1 (MVP):
- [ ] Users can register and create profiles
- [ ] Users can upload resumes
- [ ] Companies can post jobs
- [ ] Basic matching works with manual scores
- [ ] 10 test users complete full flow

### Phase 2 (Interviews):
- [ ] Users can take skill interviews
- [ ] Interviews are scored (automated + AI)
- [ ] Matching uses interview scores
- [ ] 50 interviews completed successfully

### Phase 3 (Enhancement):
- [ ] Full-text job search working
- [ ] Email notifications sent
- [ ] Analytics dashboards populated
- [ ] 100 active users

### Phase 4 (Production):
- [ ] Running entirely on AWS
- [ ] CI/CD pipeline functional
- [ ] Monitoring and alerting active
- [ ] Load tested for 1000+ users
- [ ] Security audit passed

### Phase 5 (Launch):
- [ ] 500+ registered users
- [ ] 50+ companies
- [ ] 200+ job postings
- [ ] 1000+ completed interviews
- [ ] 500+ successful matches (employer contacted candidate)

---

## Risk Mitigation

### Technical Risks:
1. **AI Scoring Inconsistency**: Build human review tool to audit AI scores
2. **Code Execution Security**: Use sandboxed environment (Judge0 or Lambda with strict limits)
3. **Matching Algorithm Accuracy**: Continuously test with real data, add feedback loop
4. **AWS Costs**: Monitor costs daily, set billing alarms, optimize resource usage

### Product Risks:
1. **Low Interview Completion**: Make interviews engaging, limit to 15-20 minutes
2. **Poor Match Quality**: Iterate on matching algorithm, add user feedback
3. **Employer Adoption**: Provide free trial, showcase candidate quality
4. **Candidate Trust**: Be transparent about AI scoring, show example questions

---

## Next Steps

1. Review this execution plan
2. Adjust timeline based on team size and resources
3. Set up project management tool (Jira, Linear, or GitHub Projects)
4. Create tickets for Phase 0 and Phase 1.1
5. Begin implementation with repository structure setup

**Estimated Total Time**:
- Phase 0-1 (MVP): 11 weeks (2.5 months)
- Phase 2 (Interviews): 7 weeks (1.5 months)
- Phase 3 (Enhancement): 8 weeks (2 months)
- Phase 4 (Production): 4 weeks (1 month)
- **Total: ~30 weeks (7 months) to production-ready system**

With a team of 2-3 developers, this timeline is achievable. Solo developer would need 10-12 months.
