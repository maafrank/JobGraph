# Phase 1: MVP - Completion Checklist

**Timeline**: Week 3-11 (9 weeks)
**Goal**: Working MVP with authentication, profiles, resume upload, job posting, and basic matching

---

## 1. Authentication Service (Week 3) ✅ COMPLETE

### 1.1 Core Authentication
- [x] Auth service structure (controllers, routes, middleware)
- [x] User registration endpoint
- [x] User login endpoint
- [x] JWT token generation
- [x] Password hashing with bcrypt
- [x] Input validation (email, password, role)
- [x] Protected routes with auth middleware
- [x] GET /api/v1/auth/me endpoint
- [ ] Refresh token support
- [ ] Logout endpoint
- [ ] Email verification (optional for MVP)

### 1.2 Testing
- [x] Manual API testing with curl/test script
- [ ] Jest integration tests for auth endpoints
- [ ] Test user registration flow
- [ ] Test login flow
- [ ] Test protected routes
- [ ] Test invalid credentials
- [ ] Test weak password validation

---

## 2. Profile Service (Week 4) ✅ COMPLETE (Candidate), ⏳ Company Profile Pending

### 2.1 Candidate Profile Management
- [x] Profile service structure
- [x] GET /api/v1/profiles/candidate - Get profile (uses JWT user_id)
- [x] PUT /api/v1/profiles/candidate - Update profile
  - [x] Headline
  - [x] Summary
  - [x] Years of experience
  - [x] Location (city, state, country)
  - [x] Remote preference
  - [x] Willing to relocate
  - [x] Profile visibility
- [x] Auto-create profile on candidate registration

### 2.2 Education Management
- [x] POST /api/v1/profiles/candidate/education - Add education
- [x] PUT /api/v1/profiles/candidate/education/:id - Update education
- [x] DELETE /api/v1/profiles/candidate/education/:id - Delete education
- [x] Validation for degree, institution, graduation year

### 2.3 Work Experience Management
- [x] POST /api/v1/profiles/candidate/experience - Add work experience
- [x] PUT /api/v1/profiles/candidate/experience/:id - Update experience
- [x] DELETE /api/v1/profiles/candidate/experience/:id - Delete experience
- [x] Support for current position (is_current flag)

### 2.4 Company Profile Management
- [ ] POST /api/v1/profiles/company - Create company profile
- [ ] GET /api/v1/profiles/company/:companyId - Get company profile
- [ ] PUT /api/v1/profiles/company - Update company profile
  - [ ] Company name
  - [ ] Description
  - [ ] Industry
  - [ ] Size
  - [ ] Website
  - [ ] Location
- [ ] Link users to companies (company_users table)

### 2.5 Testing
- [x] Test profile CRUD operations
- [x] Test education CRUD operations
- [x] Test work experience CRUD operations
- [ ] Test company profile operations
- [x] Test authorization (users can only edit their own profiles)

---

## 3. File Upload & Resume Parsing (Week 5)

### 3.1 S3 Integration
- [ ] Install AWS SDK (@aws-sdk/client-s3)
- [ ] Configure AWS credentials in .env
- [ ] Create S3 bucket for resumes
- [ ] S3 service for presigned URLs
- [ ] POST /api/v1/resumes/upload-url - Get presigned upload URL
- [ ] PUT /api/v1/resumes/confirm - Confirm upload complete
- [ ] Store resume_url in candidate_profiles

### 3.2 Resume Parsing (Basic)
- [ ] Install pdf-parse library
- [ ] Resume parser service
- [ ] Extract text from PDF
- [ ] Extract email, phone from resume
- [ ] Extract skills (keyword matching)
- [ ] Extract education section
- [ ] Extract work experience section
- [ ] Store parsed data in resume_parsed_data (JSONB)

### 3.3 Auto-fill & Follow-up Questions
- [ ] Auto-fill profile fields from parsed data
- [ ] Generate follow-up questions for missing data
- [ ] Store in follow_up_questions table
- [ ] API to retrieve follow-up questions
- [ ] API to answer follow-up questions

### 3.4 Testing
- [ ] Test presigned URL generation
- [ ] Test file upload flow
- [ ] Test resume parsing with sample PDFs
- [ ] Test auto-fill functionality
- [ ] Test follow-up question generation

---

## 4. Skills Management (Week 6)

### 4.1 Skills API
- [x] Skills seeded in Phase 0 (35 skills)
- [ ] GET /api/v1/skills - List all skills
  - [ ] Pagination support
  - [ ] Filter by category
  - [ ] Search by name
- [ ] GET /api/v1/skills/:id - Get skill details
- [ ] POST /api/v1/skills - Admin: Create skill
- [ ] PUT /api/v1/skills/:id - Admin: Update skill
- [ ] DELETE /api/v1/skills/:id - Admin: Deactivate skill

### 4.2 Manual Skill Scores (for MVP)
- [ ] POST /api/v1/profiles/candidate/skills - Add manual skill score
- [ ] PUT /api/v1/profiles/candidate/skills/:skillId - Update skill score
- [ ] DELETE /api/v1/profiles/candidate/skills/:skillId - Remove skill
- [ ] Insert into user_skill_scores table
- [ ] Set expiry date (default: 1 year)

### 4.3 Testing
- [ ] Test skills listing with pagination
- [ ] Test skills filtering
- [ ] Test manual skill score entry
- [ ] Test skill score updates

---

## 5. Job Service (Week 7)

### 5.1 Job Management
- [ ] Job service structure
- [ ] POST /api/v1/jobs - Create job posting
  - [ ] Job details (title, description, requirements)
  - [ ] Location
  - [ ] Remote option
  - [ ] Salary range
  - [ ] Employment type
  - [ ] Experience level
- [ ] GET /api/v1/jobs - List jobs
  - [ ] Pagination
  - [ ] Filter by location
  - [ ] Filter by remote option
  - [ ] Filter by experience level
  - [ ] Search by title/description
- [ ] GET /api/v1/jobs/:id - Get job details
- [ ] PUT /api/v1/jobs/:id - Update job
- [ ] DELETE /api/v1/jobs/:id - Close/cancel job
- [ ] Only employer role can create/edit jobs

### 5.2 Job Skills Management
- [ ] POST /api/v1/jobs/:id/skills - Add required skill to job
  - [ ] Skill ID
  - [ ] Weight (importance)
  - [ ] Minimum score threshold
  - [ ] Required vs optional flag
- [ ] PUT /api/v1/jobs/:id/skills/:skillId - Update skill requirement
- [ ] DELETE /api/v1/jobs/:id/skills/:skillId - Remove skill
- [ ] Validate total weights = 100 (or normalize)

### 5.3 Testing
- [ ] Test job creation
- [ ] Test job listing with filters
- [ ] Test job updates
- [ ] Test job skills management
- [ ] Test authorization (only job owner can edit)

---

## 6. Matching Service (Week 8)

### 6.1 Basic Matching Algorithm
- [ ] Matching service structure
- [ ] calculateJobMatches(jobId) function
  - [ ] Get job with required skills
  - [ ] Find candidates with ALL required skills
  - [ ] Check minimum score thresholds
  - [ ] Calculate weighted average score
  - [ ] Rank candidates by score
- [ ] Store matches in job_matches table
- [ ] POST /api/v1/matching/jobs/:jobId/calculate - Trigger matching

### 6.2 Match Retrieval
- [ ] GET /api/v1/jobs/:jobId/candidates - Employer: View matches
  - [ ] Returns ranked candidates
  - [ ] Include skill breakdown
  - [ ] Show overall match score
- [ ] GET /api/v1/profiles/candidate/matches - Candidate: View job matches
  - [ ] Returns jobs matched to user
  - [ ] Show match score and rank

### 6.3 Match Status Management
- [ ] PUT /api/v1/matching/:matchId/status - Update match status
  - [ ] Statuses: matched, contacted, interviewing, offered, rejected
- [ ] POST /api/v1/matching/:matchId/contact - Employer contacts candidate
- [ ] Send notification on contact (Phase 1: basic, Phase 2: email)

### 6.4 Testing
- [ ] Test matching algorithm with various scenarios
- [ ] Test with 0 matches (no qualified candidates)
- [ ] Test with partial skill overlap
- [ ] Test minimum threshold enforcement
- [ ] Test weighted scoring
- [ ] Test match ranking

---

## 7. Frontend MVP (Week 9-10)

### 7.1 Setup & Authentication
- [ ] Create React + TypeScript + Vite project
- [ ] Install dependencies (React Router, Axios, React Query, etc.)
- [ ] Configure Tailwind CSS or Material-UI
- [ ] Create API client with Axios
- [ ] Auth context for JWT token management
- [ ] Login page
- [ ] Registration page (candidate/employer selection)
- [ ] Protected route wrapper

### 7.2 Candidate Pages
- [ ] Candidate dashboard
- [ ] Profile management page
  - [ ] Edit basic info
  - [ ] Add/edit education
  - [ ] Add/edit work experience
- [ ] Resume upload page
  - [ ] File picker (PDF/DOCX only)
  - [ ] Upload progress indicator
  - [ ] View parsed data
  - [ ] Answer follow-up questions
- [ ] Skills management page
  - [ ] Browse skills by category
  - [ ] Add skills with self-assessed scores
  - [ ] View skill expiry dates
- [ ] Job matches page
  - [ ] View matched jobs
  - [ ] See match score and rank
  - [ ] View job details

### 7.3 Employer Pages
- [ ] Employer dashboard
- [ ] Company profile page
- [ ] Job posting form
  - [ ] Job details
  - [ ] Add required skills with weights
  - [ ] Set minimum score thresholds
- [ ] Job management page
  - [ ] List posted jobs
  - [ ] Edit/close jobs
  - [ ] Trigger matching
- [ ] Candidate matches page
  - [ ] View ranked candidates for each job
  - [ ] See skill breakdown
  - [ ] Contact candidate button
  - [ ] Update match status

### 7.4 Common Components
- [ ] Navigation bar
- [ ] Footer
- [ ] Loading spinners
- [ ] Error messages/toasts
- [ ] Confirmation modals
- [ ] Form validation

### 7.5 Testing
- [ ] Manual testing of all user flows
- [ ] Responsive design testing
- [ ] Browser compatibility testing

---

## 8. Integration & Testing (Week 11)

### 8.1 Integration Tests
- [ ] Auth service integration tests
- [ ] Profile service integration tests
- [ ] Job service integration tests
- [ ] Matching service integration tests
- [ ] Test service-to-service interactions

### 8.2 End-to-End Tests
- [ ] Candidate full flow:
  - [ ] Register → Login → Create profile → Upload resume → Add skills → View matches
- [ ] Employer full flow:
  - [ ] Register → Login → Create company → Post job → Add skills → Trigger matching → View candidates
- [ ] Matching flow:
  - [ ] Create job with skills → Add candidate with matching skills → Calculate matches → Verify results

### 8.3 Performance & Security
- [ ] Test with 100+ users
- [ ] Test with 50+ jobs
- [ ] Load testing for matching algorithm
- [ ] Security audit (SQL injection, XSS, CSRF)
- [ ] Rate limiting verification
- [ ] Authentication bypass testing

### 8.4 Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] README with setup instructions
- [ ] Architecture documentation
- [ ] Deployment guide
- [ ] User guide

---

## 9. Bug Fixes & Polish

- [ ] Fix critical bugs
- [ ] Improve error messages
- [ ] Add loading states
- [ ] Improve validation messages
- [ ] Performance optimizations
- [ ] Code cleanup and refactoring

---

## Phase 1 Success Criteria

### Core Functionality
- [ ] Users can register and login as candidate or employer
- [ ] Candidates can create profiles with education and work experience
- [ ] Candidates can upload resumes and see parsed data
- [ ] Candidates can manually add skill scores
- [ ] Companies can create company profiles
- [ ] Employers can post jobs with required skills
- [ ] Employers can set skill weights and minimum thresholds
- [ ] Matching algorithm correctly matches candidates to jobs
- [ ] Employers can view ranked candidate matches
- [ ] Candidates can view their job matches

### Technical Requirements
- [ ] All services running and communicating
- [ ] Database schema fully implemented
- [ ] JWT authentication working across all services
- [ ] S3 file upload working
- [ ] Basic resume parsing functional
- [ ] Matching algorithm accurate and tested
- [ ] Frontend fully functional

### Testing Requirements
- [ ] 90%+ code coverage on critical paths
- [ ] All integration tests passing
- [ ] End-to-end tests passing
- [ ] 10+ test users complete full flow successfully

### Performance Requirements
- [ ] API response times < 500ms for most endpoints
- [ ] Matching calculation < 5 seconds for 100 candidates
- [ ] Resume parsing < 10 seconds per file
- [ ] Frontend loads < 2 seconds

---

## Ready for Phase 2: Interview System

Once all Phase 1 items are complete, the MVP is ready for Phase 2, which will introduce:
- Interview template creation
- Automated interview administration
- AI-powered interview evaluation (Bedrock)
- Automated skill score calculation
- Interview validity and expiration

---

## Current Progress

✅ **Phase 0**: Complete - Foundation established
✅ **1. Auth Service**: Core functionality complete (missing refresh tokens, logout, email verification)
✅ **2. Profile Service (Candidate)**: Complete - All CRUD operations working
⏳ **2.4 Company Profile Management**: Not started

**Next Steps**:
1. **Option A**: Job Service (Week 7) - Start employer job posting functionality
2. **Option B**: Skills Management (Week 6) - Enable manual skill score entry for MVP
3. **Option C**: Company Profile Management - Complete remaining Profile Service work
4. **Option D**: Skip to Matching Service (Week 8) with manual test data

**Recommended**: Start with **Job Service** since it's critical for the core matching flow and we can test with manual skill scores later.
