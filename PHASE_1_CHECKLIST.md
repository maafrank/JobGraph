# Phase 1: MVP - Completion Checklist

**Timeline**: Week 3-11 (9 weeks)
**Goal**: Working MVP with authentication, profiles, resume upload, job posting, and basic matching

---

## 1. Authentication Service (Week 3) ✅ COMPLETE

### 1.1 Core Authentication
- [x] Auth service structure (controllers, routes, middleware)
- [x] User registration endpoint
- [x] User login endpoint
- [x] JWT token generation (15-minute access tokens)
- [x] Password hashing with bcrypt
- [x] Input validation (email, password, role)
- [x] Protected routes with auth middleware
- [x] GET /api/v1/auth/me endpoint
- [x] Refresh token support (7-day refresh tokens)
- [x] POST /api/v1/auth/refresh endpoint
- [x] Logout endpoint (POST /api/v1/auth/logout)
- [x] Email verification (POST /api/v1/auth/verify-email)

### 1.2 Testing
- [x] Manual API testing with curl/test script
- [ ] Jest integration tests for auth endpoints
- [ ] Test user registration flow
- [ ] Test login flow
- [ ] Test protected routes
- [ ] Test invalid credentials
- [ ] Test weak password validation

---

## 2. Profile Service (Week 4) ✅ COMPLETE

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

### 2.4 Company Profile Management ✅ COMPLETE
- [x] POST /api/v1/profiles/company - Create company profile
- [x] GET /api/v1/profiles/companies/:companyId - Get company profile (public)
- [x] GET /api/v1/profiles/company - Get my company (private)
- [x] GET /api/v1/profiles/companies - List companies (public, with pagination/filters)
- [x] PUT /api/v1/profiles/company - Update company profile
  - [x] Company name
  - [x] Description
  - [x] Industry
  - [x] Size
  - [x] Website
  - [x] Location
- [x] Link users to companies (company_users table)
- [x] Role-based access control (employer only, owner/admin for updates)
- [x] Business logic validations (unique names, one company per user)

### 2.5 Testing
- [x] Test profile CRUD operations
- [x] Test education CRUD operations
- [x] Test work experience CRUD operations
- [x] Test company profile operations (test-company-api.sh - 6 tests)
- [x] Test authorization (users can only edit their own profiles)

---

## 3. File Upload & Resume Parsing (Week 5) ✅ COMPLETE

### 3.1 Database Schema for Documents ✅ COMPLETE
- [x] Create user_documents table with BYTEA storage
  - [x] document_id, user_id, document_type (resume, cover_letter)
  - [x] file_name, file_size, mime_type
  - [x] file_data BYTEA (stores actual file binary)
  - [x] is_current flag for version management
  - [x] upload_status (pending, processing, completed, failed)
- [x] Create resume_parsed_data table (JSONB storage)
  - [x] parsed_data_id, document_id, user_id
  - [x] contact_info JSONB (email, phone, linkedin, location)
  - [x] summary TEXT
  - [x] skills JSONB (extracted skills with confidence)
  - [x] education JSONB (degrees, institutions, dates)
  - [x] work_experience JSONB (companies, titles, dates, descriptions)
  - [x] certifications JSONB (optional)
  - [x] raw_text TEXT (full extracted text)
  - [x] parser_used, confidence_score, parsing_errors
- [x] Create resume_autofill_suggestions table
  - [x] suggestion_id, user_id, document_id
  - [x] suggestion_type (education, work_experience, skills, basic_info)
  - [x] suggested_data JSONB
  - [x] status (pending, accepted, rejected)
  - [x] created_at, applied_at
- [x] Add indexes for performance

### 3.2 File Upload API ✅ COMPLETE
- [x] Install multer for file upload handling
- [x] POST /api/v1/profiles/candidate/resume/upload - Upload resume
  - [x] Multipart form data handling
  - [x] File validation (type: PDF/DOCX/TXT, size: max 10MB)
  - [x] Store file_data in user_documents table
  - [x] Return document_id and upload confirmation
  - [x] Trigger parsing job (async with Claude Haiku 4.5)
- [x] GET /api/v1/profiles/candidate/resume - Get current resume metadata
- [x] GET /api/v1/profiles/candidate/resume/download - Download resume file
  - [x] Retrieve file_data from database
  - [x] Set proper Content-Type and Content-Disposition headers
  - [x] Stream binary data to client
- [x] DELETE /api/v1/profiles/candidate/resume/:documentId - Delete resume

### 3.3 Resume Parsing (AI-Powered) ✅ COMPLETE
- [x] Install pdf-parse library for PDF extraction
- [x] Install mammoth library for DOCX extraction
- [x] **AI-powered parsing with Claude Haiku 4.5 (Anthropic API)**
  - [x] parseResume(documentId) - Main parsing orchestrator
  - [x] extractTextFromPDF(buffer) - PDF text extraction
  - [x] extractTextFromDOCX(buffer) - DOCX text extraction
  - [x] extractTextFromTXT(buffer) - Plain text handling
- [x] **Intelligent structured data extraction** (Claude AI handles all extraction)
  - [x] extractContactInfo(text) - Email, phone, LinkedIn, location
  - [x] extractSkills(text) - Match against skills database
  - [x] extractEducation(text) - Degree, institution, graduation year, GPA
  - [x] extractWorkExperience(text) - Title, company, dates, description
  - [x] extractSummary(text) - Professional summary/objective OR auto-generated from work history
- [x] **Automatic profile population** - Directly fills profile fields (not suggestions-based)
  - [x] Uses NULLIF to handle empty strings properly
  - [x] Date normalization (YYYY-MM, YYYY → YYYY-MM-DD)
  - [x] Column name mapping (years_experience, not years_of_experience)
- [x] Store parsed data in resume_parsed_data table
- [x] Update document status (processing → completed/failed)
- [x] Error handling and logging

### 3.4 Auto-fill Suggestions (Backend API Ready, Frontend UI Optional)
- [x] **Backend API fully implemented** (suggestions table and endpoints ready)
- [x] GET /api/v1/profiles/candidate/resume/suggestions - Get pending suggestions
  - [x] Return categorized suggestions (basic_info, education, work_experience, skills)
  - [x] Include confidence scores
- [x] POST /api/v1/profiles/candidate/resume/suggestions/:suggestionId/apply - Accept suggestion
  - [x] Insert/update profile data based on suggestion
  - [x] Mark suggestion as accepted
  - [x] Return updated profile
- [x] DELETE /api/v1/profiles/candidate/resume/suggestions/:suggestionId - Reject suggestion
  - [x] Mark suggestion as rejected
- [ ] **Frontend UI for suggestions** (Optional - deferred, auto-fill currently bypasses suggestions)
  - [ ] Modal to review individual suggestions before applying
  - [ ] Accept/reject controls with confidence scores
  - Note: Current implementation auto-fills profile immediately; suggestions API available for future granular control

### 3.5 Employer Resume Access ✅ COMPLETE
- [x] resume_shares table already exists in schema
  - [x] share_id, document_id, user_id (candidate)
  - [x] shared_with_company_id, shared_for_job_id
  - [x] share_status (active, revoked, expired)
  - [x] expires_at, created_at, access tracking (access_count, last_accessed_at)
- [x] **Auto-share on job application** (Privacy-first approach)
  - [x] When candidate applies to job → resume automatically shared with employer's company
  - [x] Share expires after 90 days
  - [x] Duplicate share prevention
- [x] **Auto-share on match calculation**
  - [x] When employer calculates matches → resumes of all matched candidates auto-shared
  - [x] Enables employers to review candidates proactively
- [x] **Resume access endpoints** (Matching Service)
  - [x] GET /api/v1/matching/candidates/:userId/resume/metadata - Get resume info with parsed data
  - [x] GET /api/v1/matching/candidates/:userId/resume/download - Download resume file
  - [x] GET /api/v1/matching/candidates/:userId/resume/parsed - Get structured parsed data
  - [x] Access control: verify active share before allowing access
  - [x] Access tracking: increment access_count, update last_accessed_at
- [x] **Enhanced getJobCandidates API**
  - [x] Include hasResume, resumeShared, resumeFileName, resumeUploadedAt fields
  - [x] LEFT JOIN with resume_shares to show sharing status
- [x] **Frontend integration** (CandidateMatchesPage)
  - [x] Download Resume button (shown when resumeShared = true)
  - [x] "Resume not yet shared" message (when hasResume but not shared)
  - [x] Download handler with error handling
  - [x] Success/error toast notifications
- [x] **E2E Testing**
  - [x] Test script: /tmp/test-resume-sharing-flow.sh
  - [x] 15/15 tests passing
  - [x] Validates: auto-share on apply, access control, metadata, download, parsed data

### 3.6 Frontend Components ✅ COMPLETE
- [x] Resume upload component (file picker with validation)
  - [x] File validation feedback (type and size)
  - [x] Upload progress/loading state
  - [x] Success/error notifications (toast)
- [x] Resume viewer/manager in Profile page (ResumeSection component)
  - [x] Display current resume (filename, size, upload date)
  - [x] Upload status badges (pending, processing, completed, failed)
  - [x] Profile auto-filled indicator
  - [x] Download button
  - [x] Delete button with confirmation
  - [x] Replace resume functionality
  - [x] Polling for parsing status (3-second intervals)
  - [x] **Auto-refresh on completion** (sessionStorage-based one-time reload)
- [ ] Auto-fill suggestions modal (Optional - deferred)
  - Frontend UI not implemented (auto-fill is immediate)
  - Backend API ready if granular control needed later
- [ ] Resume attachment in job application flow (Optional - Phase 2)
  - Not yet implemented
  - Can be added when employer resume viewing is required

### 3.7 Testing
- [x] Test file upload with PDF, DOCX, TXT files
- [x] Test file size validation (reject > 10MB)
- [x] Test file type validation (reject unsupported formats)
- [x] Test resume parsing with sample resumes
  - [x] Manual testing with real resumes
  - [x] Verify text extraction accuracy (Claude Haiku handles this)
  - [x] Verify data extraction (email, phone, skills, education, work experience, summary)
  - [x] Test intelligent summary generation when resume lacks summary section
- [x] Test auto-fill suggestions generation (backend API verified with test-suggestions-api.sh)
- [x] Test suggestion apply/reject flows (backend ready, frontend UI deferred)
- [x] Test resume download functionality
- [x] Test resume delete functionality
- [x] **Test employer resume access (privacy controls)** ✅ COMPLETE
  - [x] Test script: /tmp/test-resume-sharing-flow.sh
  - [x] Test auto-share on job application
  - [x] Test auto-share on match calculation
  - [x] Test resume share creation in database
  - [x] Test enhanced getJobCandidates API with resume metadata
  - [x] Test resume metadata endpoint (access control)
  - [x] Test resume download endpoint (file transfer)
  - [x] Test parsed resume data endpoint
  - [x] All 15 tests passing
- [x] Integration test: Upload → Parse → Auto-fill → Profile Updated (working end-to-end)

---

## 4. Skills Management (Week 6) ✅ COMPLETE

### 4.1 Skills API
- [x] Skills seeded in Phase 0 (35 skills)
- [x] GET /api/v1/skills - List all skills
  - [x] Pagination support
  - [x] Filter by category
  - [x] Search by name
- [x] GET /api/v1/skills/:id - Get skill details
- [x] GET /api/v1/skills/categories - Get distinct categories
- [ ] POST /api/v1/skills - Admin: Create skill (deferred to Phase 2)
- [ ] PUT /api/v1/skills/:id - Admin: Update skill (deferred to Phase 2)
- [ ] DELETE /api/v1/skills/:id - Admin: Deactivate skill (deferred to Phase 2)

### 4.2 Manual Skill Scores (for MVP)
- [x] GET /api/v1/profiles/candidate/skills - View candidate's skill scores
- [x] POST /api/v1/profiles/candidate/skills - Add manual skill score
- [x] PUT /api/v1/profiles/candidate/skills/:skillId - Update skill score
- [x] DELETE /api/v1/profiles/candidate/skills/:skillId - Remove skill
- [x] Insert into user_skill_scores table (interview_id nullable for manual entry)
- [x] Set expiry date (default: 1 year)
- [x] Score validation (0-100 range)
- [x] Duplicate skill prevention

### 4.3 Testing
- [x] Test skills listing with pagination
- [x] Test skills filtering
- [x] Test manual skill score entry
- [x] Test skill score updates
- [x] Test skill score deletion
- [x] Integrated into test-phase1.sh (Tests 25-30)

---

## 5. Job Service (Week 7) ✅ COMPLETE

### 5.1 Job Management
- [x] Job service structure
- [x] POST /api/v1/jobs - Create job posting
  - [x] Job details (title, description, requirements)
  - [x] Location
  - [x] Remote option
  - [x] Salary range
  - [x] Employment type
  - [x] Experience level
- [x] GET /api/v1/jobs - List jobs
  - [x] Pagination
  - [x] Filter by location
  - [x] Filter by remote option
  - [x] Filter by experience level
  - [x] Search by title/description
- [x] GET /api/v1/jobs/:id - Get job details
- [x] PUT /api/v1/jobs/:id - Update job
- [x] DELETE /api/v1/jobs/:id - Close/cancel job
- [x] Only employer role can create/edit jobs
- [x] Company ownership verification

### 5.2 Job Skills Management
- [x] POST /api/v1/jobs/:id/skills - Add required skill to job
  - [x] Skill ID
  - [x] Weight (importance)
  - [x] Minimum score threshold
  - [x] Required vs optional flag
- [x] PUT /api/v1/jobs/:id/skills/:skillId - Update skill requirement
- [x] DELETE /api/v1/jobs/:id/skills/:skillId - Remove skill
- [x] Weight normalization (stored as decimal 0-1)

### 5.3 Job Applications ✅ COMPLETE
- [x] Database migration: job_applications table with status workflow
- [x] POST /api/v1/jobs/:jobId/apply - Candidate applies to job
  - [x] Cover letter (optional)
  - [x] Resume URL (optional)
  - [x] Duplicate application prevention (UNIQUE constraint)
  - [x] Active job validation
- [x] GET /api/v1/jobs/applications - Get my applications (candidate)
  - [x] Pagination support
  - [x] Filter by status
  - [x] Include match scores via LEFT JOIN
- [x] GET /api/v1/jobs/applications/:applicationId - Get application details
- [x] DELETE /api/v1/jobs/applications/:applicationId - Withdraw application
  - [x] Only allow for submitted/under_review status
- [x] GET /api/v1/matching/applications/:applicationId - Employer view application
  - [x] Include cover letter and full candidate profile
  - [x] Auto-mark as reviewed
- [x] PUT /api/v1/matching/applications/:applicationId/status - Update application status
  - [x] Employer-only action
  - [x] Status workflow: submitted → under_review → interviewing → accepted/rejected
- [x] Enhanced getJobCandidates to include application data
  - [x] LEFT JOIN job_applications
  - [x] Add hasApplied, applicationStatus, appliedAt fields
  - [x] Source tracking: 'matched', 'applied', 'both'

### 5.4 Testing
- [x] Test job creation
- [x] Test job listing with filters
- [x] Test job updates
- [x] Test job skills management
- [x] Test authorization (only job owner can edit)
- [x] Integrated into test-phase1.sh (Tests 21-24)
- [x] Job applications manual testing (test-applications.sh)

---

## 6. Matching Service (Week 8) ✅ COMPLETE

### 6.1 Enhanced Matching Algorithm
- [x] Matching service structure
- [x] calculateJobMatches(jobId) function
  - [x] Get job with required skills
  - [x] Find candidates with ALL required skills
  - [x] Check minimum score thresholds
  - [x] Calculate weighted average score
  - [x] Rank candidates by score
- [x] Store matches in job_matches table
- [x] POST /api/v1/matching/jobs/:jobId/calculate - Trigger matching
- [x] **Enhanced matching algorithm with holistic scoring**
  - [x] Base skill score with weighted averages
  - [x] Penalty for missing required skills (0/2 = max 25%, 1/2 = max 50%)
  - [x] Experience level matching bonus (0-5 points)
  - [x] Location/remote preference bonus (0-5 points)
  - [x] Education relevance bonus (0-3 points)
  - [x] Work experience relevance bonus (0-2 points)
  - [x] Final score normalized to 0-100% scale

### 6.2 Match Retrieval
- [x] GET /api/v1/matching/jobs/:jobId/candidates - Employer: View matches
  - [x] Returns ranked candidates
  - [x] Include skill breakdown
  - [x] Show overall match score
- [x] GET /api/v1/matching/candidate/matches - Candidate: View job matches
  - [x] Returns jobs matched to user
  - [x] Show match score and rank
- [x] GET /api/v1/matching/candidate/browse-jobs - Browse ALL jobs with scores
  - [x] Calculate match score for every active job
  - [x] Include partial matches (even if missing required skills)
  - [x] Show required vs optional skills clearly
  - [x] Filter and sort capabilities

### 6.3 Match Status Management
- [x] PUT /api/v1/matching/matches/:matchId/status - Update match status
  - [x] Statuses: matched, contacted, interviewing, offered, rejected, hired
- [x] POST /api/v1/matching/matches/:matchId/contact - Employer contacts candidate
- [x] Notification placeholder (Phase 2: email via SES)

### 6.4 Testing
- [x] Test matching algorithm with various scenarios
- [x] Test with 0 matches (no qualified candidates)
- [x] Test minimum threshold enforcement
- [x] Test weighted scoring
- [x] Test match ranking
- [x] Test enhanced scoring factors (experience, location, education, work history)
- [x] Integrated into test-phase1.sh (Tests 31-36)

---

## 7. Frontend MVP (Week 9-10) ✅ COMPLETE

### 7.1 Setup & Authentication ✅ COMPLETE
- [x] Create React + TypeScript + Vite project
- [x] Install dependencies (React Router, Axios, React Query, Tailwind CSS)
- [x] Configure Tailwind CSS
- [x] Project structure setup (pages, components, services, contexts, types)
- [x] Create API client with Axios interceptors
- [x] Auth context for JWT token management (access + refresh tokens)
- [x] Login page with form validation
- [x] Registration page (candidate/employer selection)
- [x] Protected route wrapper component
- [x] Logout functionality

### 7.2 Common Components & Layout ✅ COMPLETE
- [x] Layout component with navigation
- [x] Navigation bar (responsive, role-based menu)
- [x] Footer component
- [x] Loading spinner component
- [x] Button component (variants: primary, secondary, danger, ghost)
- [x] Input component (text, email, password, with validation)
- [x] Textarea component
- [x] Select/Dropdown component
- [x] Modal component (reusable)
- [x] Toast/Alert notification system (Zustand-based)
- [x] Card component for content sections
- [x] Form validation in Login/Register pages
- [x] Password visibility toggle with eye icons
- [x] Clickable logo navigation to homepage
- [x] Homepage with automatic redirect for authenticated users

### 7.3 Candidate Pages
- [x] Candidate dashboard (overview stats, quick actions) ✅ COMPLETE
  - [x] Profile completion percentage
  - [x] Skills count display
  - [x] Job matches count
  - [x] Quick action buttons for profile, skills, matches
  - [x] Getting started checklist with progress tracking
  - [x] Recent matches preview (top 3)
- [x] Profile management page ✅ COMPLETE
  - [x] View/Edit basic info (headline, summary, location, years of experience)
  - [x] Remote preference dropdown (onsite, hybrid, remote, flexible)
  - [x] Willing to relocate checkbox
  - [x] Profile visibility settings (public, private, anonymous)
  - [x] Add/edit/delete education entries (degree, institution, graduation year, GPA)
  - [x] Add/edit/delete work experience entries (title, company, dates, description)
  - [x] Current position checkbox
  - [x] All CRUD operations working with proper field name mapping (snake_case backend ↔ camelCase frontend)
  - [x] Form validation and error handling
  - [x] Toast notifications for success/error feedback
  - [x] Modal forms for education and work experience
  - [x] Auto-refresh profile after updates
- [x] Skills management page ✅ COMPLETE
  - [x] Two-tab interface (My Skills, Browse Skills)
  - [x] Browse skills by category (dropdown filter)
  - [x] Search skills by name
  - [x] Add skills with manual scores (0-100 slider with visual feedback)
  - [x] Edit existing skill scores
  - [x] Delete skill scores
  - [x] View skill expiry dates (acquired_at, expires_at)
  - [x] Color-coded proficiency levels (Beginner/Intermediate/Advanced/Expert)
  - [x] Score guidelines in modal (0-39: Beginner, 40-59: Intermediate, 60-79: Advanced, 80-100: Expert)
  - [x] Prevent duplicate skills (shows info toast if already added)
  - [x] Display skill categories as badges
  - [x] Backend API using snake_case field names (skill_id, skill_name, created_at)
  - [x] Modal for add/edit with score slider
  - [x] Empty state with call-to-action
- [x] Job matches page ✅ COMPLETE
  - [x] View ALL jobs with calculated match scores (sorted by score)
  - [x] See match score, qualification status, and job details
  - [x] Clear separation of Required vs Optional skills
  - [x] Color-coded skill badges (green=meets threshold, red=missing/below, blue=optional)
  - [x] Filter by location type (all, remote only, on-site only)
  - [x] Filter by qualification (all, fully qualified, partial match)
  - [x] Sort by match score or date posted
  - [x] Job detail modal with complete skill breakdown
  - [x] Visual progress bars for skill scores
  - [x] Shows skill weights and minimum thresholds
  - [x] **Apply to jobs functionality** ✅
    - [x] Apply button on job cards
    - [x] Apply modal with cover letter (optional)
    - [x] Track applied jobs (✓ Applied badge)
    - [x] Duplicate application prevention
    - [x] Success/error toast notifications
- [x] My Applications page ✅ COMPLETE
  - [x] View all submitted applications
  - [x] Filter by application status (submitted, under_review, interviewing, accepted, rejected, withdrawn)
  - [x] Application status badges with color coding
  - [x] Display match score if calculated
  - [x] Application details modal (cover letter, timeline, job details)
  - [x] Withdraw application functionality (for submitted/under_review)
  - [x] Empty state with link to browse jobs

### 7.4 Employer Pages
- [x] Employer dashboard (company stats, recent jobs) ✅ COMPLETE
  - [x] Active jobs count
  - [x] Total matches count
  - [x] Contacted candidates count
  - [x] Quick action button to post new job
  - [x] Getting started guide for new employers
- [x] Company profile page ✅ COMPLETE
  - [x] Create company profile (first-time flow)
  - [x] View/Edit company details
  - [x] Company size, industry, website, location
- [x] Job posting form ✅ COMPLETE
  - [x] Job details (title, description, requirements, responsibilities)
  - [x] Location, remote option (onsite/remote/hybrid/flexible), salary range
  - [x] Employment type (full-time, part-time, contract, internship)
  - [x] Experience level (entry, mid, senior, lead, executive)
  - [x] Add required/optional skills with weights (0-100 slider)
  - [x] Set minimum score thresholds per skill (0-100 slider)
  - [x] Visual proficiency indicators on sliders
  - [x] Save as draft or publish (active status)
  - [x] Edit existing jobs with pre-populated fields
  - [x] Skills displayed separately (Required vs Optional)
  - [x] Color-coded skill badges and status indicators
  - [x] Backend weight conversion (percentage ↔ decimal 0-1)
  - [x] Field name mapping (camelCase frontend ↔ snake_case database)
  - [x] Database migration: Added responsibilities column to jobs table
  - [x] All CRUD operations for job skills (add/edit/remove)
- [x] Job management page ✅ COMPLETE
  - [x] List all posted jobs (active/draft/closed)
  - [x] Status filter tabs (all, active, draft, closed)
  - [x] Edit/close/reopen jobs
  - [x] Trigger matching calculation (auto-calculates for active jobs on page load)
  - [x] View match statistics (match count per job)
  - [x] Delete jobs
  - [x] Navigate to View Candidates page
  - [x] Publish draft jobs
  - [x] Display job details (salary, location, remote option, posted date, required skills count)
- [x] Candidate matches page (per job) ✅ COMPLETE
  - [x] View ranked candidates for selected job
  - [x] See overall match score and rank
  - [x] Skill-by-skill breakdown table
  - [x] Contact candidate button (updates status)
  - [x] Update match status dropdown
  - [x] **Filter tabs: All / Applied / Matched Only** ✅
  - [x] **Application status badges and dates** ✅
    - [x] Show application status with color coding (📝 badge)
    - [x] Display match status (🎯 badge)
    - [x] Source badge (✓ Applied & Matched)
    - [x] Applied date, contacted date, reviewed date
  - [x] **View Application button** ✅
    - [x] Opens application details modal
    - [x] Shows cover letter
    - [x] Displays match score and rank
    - [x] Full candidate profile (headline, summary, location, experience)
    - [x] Skill breakdown with scores
    - [x] Application timeline
    - [x] Update application status dropdown
  - [x] **Enhanced candidate display** ✅
    - [x] Separate match status and application status
    - [x] Show dates (applied, contacted, reviewed)
    - [x] Candidate counts: total and applied

### 7.5 Testing & Polish
- [ ] Manual testing of candidate registration → profile → skills → view matches
- [ ] Manual testing of employer registration → company → job posting → matching → view candidates
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Form validation on all inputs
- [ ] Error handling for API failures
- [ ] Loading states for async operations
- [ ] Browser compatibility (Chrome, Firefox, Safari)
- [ ] Accessibility basics (keyboard navigation, ARIA labels)

---

## 8. Integration & Testing (Week 11)

### 8.1 Integration Tests
- [ ] Auth service integration tests
- [ ] Profile service integration tests
- [ ] Job service integration tests
- [ ] Matching service integration tests
- [ ] Test service-to-service interactions

### 8.2 End-to-End Tests
- [x] **Candidate full flow** ✅ (20/20 tests passing - 100%)
  - [x] Register with validation (weak passwords rejected)
  - [x] Login with credentials
  - [x] Create/update profile (basic info, education, work experience)
  - [x] Add skills with manual scores
  - [x] Update and delete skills
  - [x] Browse all jobs with match scores
  - [x] Apply to jobs with cover letter
  - [x] View applications and withdraw
  - [x] Test script: `/tmp/test-e2e-complete.sh`
- [x] **Employer full flow** ✅ (13/13 tests passing - 100%)
  - [x] Register as employer
  - [x] Login with credentials
  - [x] Create company profile
  - [x] Get and update company profile
  - [x] Create job posting with details
  - [x] Add required skills (Python, Django) with weights and thresholds
  - [x] Add optional skills (React)
  - [x] List employer's jobs
  - [x] Get job details
  - [x] Calculate matches for job
  - [x] View matched candidates
  - [x] Test script: `/tmp/test-e2e-employer-flow.sh`
- [x] Matching flow:
  - [x] Create job with skills → Calculate matches → Verify results (integrated in employer flow)

### 8.3 Performance & Security
- [ ] Test with 100+ users
- [ ] Test with 50+ jobs
- [ ] Load testing for matching algorithm
- [ ] Security audit (SQL injection, XSS, CSRF)
- [ ] Rate limiting verification
- [ ] Authentication bypass testing

### 8.4 Documentation
- [x] **E2E_TEST_PLAN.md** - Comprehensive manual testing guide (150+ test cases)
- [x] **BUG_FIXES_SUMMARY.md** - Complete documentation of bugs found and fixed
- [x] **Test Scripts** - Automated E2E tests for candidate and employer flows
- [ ] API documentation (Swagger/OpenAPI)
- [ ] README with setup instructions
- [ ] Architecture documentation
- [ ] Deployment guide
- [ ] User guide

---

## 9. Bug Fixes & Polish

- [x] **Fix critical bugs** ✅
  - [x] BUG-003: Skills API inconsistent field names (skill_name → name)
    - Fixed backend to return camelCase consistently (skillId, name, createdAt)
    - Updated frontend TypeScript interfaces to match
    - Updated SkillsPage component to use new field names
  - [x] Test script issues: Fixed field name mappings in E2E tests
  - [x] Company creation: Fixed duplicate name issue with unique timestamps
  - [x] Job listing: Fixed response structure parsing in tests
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

## Future Phases: File Storage Migration

### Phase 4: S3 Migration (Production Scale)

When the platform reaches production scale (10,000+ users, significant file volume), migrate from PostgreSQL BYTEA to AWS S3:

**Why Migrate Later:**
- Database becomes bloated with binary data
- Backup/restore times increase significantly
- Need CDN (CloudFront) for global file delivery
- Want versioning and lifecycle policies

**Migration Plan:**

1. **Infrastructure Setup**
   - [ ] Create S3 bucket (jobgraph-resumes-prod)
   - [ ] Configure bucket policies and CORS
   - [ ] Set up CloudFront distribution
   - [ ] Configure lifecycle rules (archive old versions to Glacier)

2. **Database Schema Updates**
   - [ ] Add columns to user_documents: s3_key, s3_bucket, s3_url
   - [ ] Keep file_data column for backward compatibility during migration
   - [ ] Add migration_status column (not_migrated, migrated, verified)

3. **Migration Script**
   - [ ] Create background job to migrate existing files
   - [ ] For each document: Upload file_data to S3 → Update s3_key → Verify → Clear file_data
   - [ ] Run in batches to avoid overwhelming database
   - [ ] Keep detailed migration logs

4. **Code Updates**
   - [ ] Update upload endpoint to use presigned URLs
   - [ ] Update download endpoint to check s3_key first, fallback to file_data
   - [ ] Update delete endpoint to remove from both S3 and database

5. **Enhanced Features with S3**
   - [ ] Resume versioning (keep history of uploads)
   - [ ] CloudFront CDN for fast global downloads
   - [ ] S3 event triggers for automatic parsing (Lambda)
   - [ ] Lifecycle policies (auto-delete after X years)
   - [ ] Integration with AWS Textract for better parsing

**Estimated Timeline:** 2-3 weeks during Phase 4
**Cost Impact:** ~$0.023/GB/month + CloudFront data transfer

---

## Current Progress

✅ **Phase 0**: Complete - Foundation established
✅ **1. Auth Service**: FULLY COMPLETE - JWT auth with refresh tokens, logout, and email verification
✅ **2. Profile Service**: FULLY COMPLETE - Candidate profiles AND company profiles fully operational
✅ **3. File Upload & Resume Parsing**: FULLY COMPLETE - AI-powered parsing with Claude Haiku 4.5, automatic profile auto-fill, intelligent summary generation, **employer resume access with privacy controls**
✅ **4. Skills Management**: Complete - Skills API and manual skill score management
✅ **5. Job Service**: Complete - Job posting and skills management with job applications
✅ **6. Matching Service**: Complete - Enhanced holistic algorithm with resume sharing integration
✅ **7. Frontend MVP**: FULLY COMPLETE - All candidate and employer pages implemented

**Services Running:**
- Auth Service (Port 3000) - `/api/v1/auth/*`
- Profile Service (Port 3001) - `/api/v1/profiles/*`
- Job Service (Port 3002) - `/api/v1/jobs/*`
- Skills Service (Port 3003) - `/api/v1/skills/*`
- Matching Service (Port 3004) - `/api/v1/matching/*`
- Frontend (Port 5173) - React + TypeScript + Vite

**Test Coverage:**
- 52 integration tests in `test-phase1.sh` covering all 5 services (all passing ✅)
- 20 E2E tests for candidate flow in `/tmp/test-e2e-complete.sh` (100% passing ✅)
- 13 E2E tests for employer flow in `/tmp/test-e2e-employer-flow.sh` (100% passing ✅)
- 15 E2E tests for resume sharing flow in `/tmp/test-resume-sharing-flow.sh` (100% passing ✅)
- 10 Settings API tests in `/tmp/test-settings-api.sh` (100% passing ✅)
- Individual test scripts: `test-auth-api.sh`, `test-profile-api.sh`, `test-job-api.sh`, `test-skills-api.sh`, `test-company-api.sh`
- **Total: 110 automated tests across backend and E2E flows** 🎉

**Core Backend MVP Complete!** All 5 backend microservices are implemented and operational.
**Frontend Foundation Complete!** Authentication, layout, and common components are working.

**Frontend Features Implemented:**
- ✅ Login and registration with form validation
- ✅ Password visibility toggle with eye icons
- ✅ JWT token management (access + refresh tokens with automatic refresh)
- ✅ Protected routes with role-based access control
- ✅ Zustand state management for auth and toasts
- ✅ Toast notification system with 4 types (success, error, info, warning)
- ✅ 8 reusable components (Button, Input, Textarea, Select, Card, Modal, LoadingSpinner, Toast)
- ✅ Responsive navbar with role-based menus
- ✅ Homepage with auto-redirect for authenticated users
- ✅ Test credentials displayed on login page

**Candidate Pages (All Complete):**
- ✅ **Candidate Dashboard** - Profile completion %, skills count, matches count, quick actions, getting started checklist
- ✅ **Profile Management Page** - Complete CRUD for basic info, education, and work experience
- ✅ **Skills Management Page** - Complete CRUD for manual skill scores with proficiency sliders
- ✅ **Job Matches Page** - Browse all jobs with real-time match scores, required vs optional skills, apply to jobs
- ✅ **My Applications Page** - Track all applications with status filtering, withdraw functionality
- ✅ **Settings Page** - Account management, privacy settings, password/email changes, account deletion

**Employer Pages (All Complete):**
- ✅ **Employer Dashboard** - Active jobs count, total matches, contacted candidates, getting started guide
- ✅ **Company Profile Page** - First-time setup flow, view/edit company details
- ✅ **Job Posting Page** - Create/edit jobs with skills, weights, thresholds, responsibilities
- ✅ **Job Management Page** - List all jobs, status filters, publish drafts, close/reopen, auto-calculate matches, delete jobs
- ✅ **Candidate Matches Page** - View ranked candidates, application integration, status management, contact candidates, **download resumes with privacy controls**
- ✅ **Settings Page** - Account management, company settings link, password/email changes, account deletion

**Next Steps:**
1. **Integration & Testing (Week 11)** - ← CURRENT PRIORITY
   - End-to-end testing of complete user flows
   - Manual testing and bug fixes
   - Performance testing
   - Code cleanup and documentation
2. **Phase 2** - Interview System with AI-powered evaluation

**Phase 1 Status**: ✅ **ALL CORE FEATURES COMPLETE!** The MVP is fully functional with all planned candidate and employer features implemented. Ready for comprehensive testing.

---

## PRE-PHASE 2 PRIORITIES 🎯

**Goal**: Polish Phase 1 features before moving to Phase 2 Interview System

### 1. Performance Documentation ✅ COMPLETE
- [x] PERFORMANCE_ANALYSIS.md created with comprehensive analysis
- [x] Identified bottlenecks: N+1 queries, missing indexes, frontend re-rendering
- [x] Database indexes added (Migration 008 applied)
- [x] Implementation roadmap with P0/P1/P2 priorities
- [x] Cost impact analysis and load testing scenarios

### 2. Jest Integration Tests (Testing Gap)
- [x] Jest unit tests for utils (password hashing, email validation, password strength)
  - [x] Located at: `/Users/matthewfrank/Documents/Business/JobGraph/backend/tests/unit/utils.test.ts`
- [ ] Jest integration tests for Auth Service endpoints
  - [ ] Test user registration flow (valid/invalid inputs)
  - [ ] Test login flow (correct/incorrect credentials)
  - [ ] Test protected routes (with/without token)
  - [ ] Test token refresh flow
  - [ ] Test weak password validation
  - [ ] Test email verification
- [ ] Jest integration tests for Profile Service
  - [ ] Test profile CRUD with authorization
  - [ ] Test education CRUD operations
  - [ ] Test work experience CRUD operations
- [ ] Jest integration tests for Job Service
  - [ ] Test job creation with skills
  - [ ] Test job listing with filters
  - [ ] Test authorization (only owner can edit)
- **Note**: We have comprehensive bash test scripts in /tmp/ but missing Jest-based integration tests for CI/CD

### 3. Enhanced Registration Flow (UX Improvement) - HIGH PRIORITY ⭐ ✅ COMPLETE
- [x] **Employer Enhanced Registration**
  - [x] Collect company name during employer registration
  - [x] Auto-create company_profiles record on employer registration
  - [x] Link user to company via company_users table (as 'owner')
  - [x] Skip "Create Company" step in employer onboarding
  - [x] Backend: Modify `/api/v1/auth/register` to handle employer-specific data
  - [x] Frontend: Add company name field to registration form (conditional on employer role)
  - [x] Validation: Company name required for employer registration

- [x] **Candidate Enhanced Registration**
  - [x] Collect additional profile fields during candidate registration
    - [x] Phone number (stored in users table)
    - [x] LinkedIn URL
    - [x] Portfolio URL
    - [x] GitHub URL
  - [x] Backend: Modify `/api/v1/auth/register` to accept additional candidate fields
  - [x] Frontend: Add fields to candidate registration form (conditional on candidate role)
  - [x] Database migration 009: Add linkedin_url, portfolio_url, github_url to candidate_profiles
  - [x] Auto-populate candidate_profiles with collected data on registration
  - [x] URL validation on frontend (optional fields, format checked if provided)
  - [x] Profile Service updated to return and update social links

- [x] **Testing**
  - [x] Test script: `/tmp/test-enhanced-registration.sh`
  - [x] 13/13 tests passing (100%)
  - [x] Employer flow: Company auto-creation, user linking, validation
  - [x] Candidate flow: Phone and social links saved, optional fields work
  - [x] Database integrity verified via direct queries

### 4. Settings Pages (User Management) - HIGH PRIORITY ⭐ ✅ COMPLETE
- [x] **Candidate Settings Page** (`/candidate/settings`)
  - [x] Account Settings Tab
    - [x] Display current email (read-only)
    - [x] Change password form (current password, new password, confirm)
    - [x] Email change functionality (require verification)
  - [x] Privacy Settings Tab
    - [x] Profile visibility dropdown (public, private, anonymous)
    - [x] Resume sharing preferences display
  - [x] Notification Preferences Tab (Placeholder for Phase 2)
    - [x] Display "Coming soon in Phase 2" message
  - [x] Danger Zone Tab
    - [x] Delete account button (with confirmation modal)
    - [x] Warning message about data deletion
    - [x] Require password confirmation

- [x] **Employer Settings Page** (`/employer/settings`)
  - [x] Account Settings Tab
    - [x] Display current email (read-only)
    - [x] Change password form
    - [x] Email change functionality
  - [x] Company Settings Tab
    - [x] Link to company profile page
    - [x] Company user management (Phase 2+ - show placeholder)
  - [x] Notification Preferences Tab (Placeholder for Phase 2)
    - [x] Display "Coming soon in Phase 2" message
  - [x] Danger Zone Tab
    - [x] Delete account button
    - [x] Warning about company data deletion
    - [x] Require password confirmation

- [x] **Backend API Endpoints**
  - [x] `PUT /api/v1/auth/change-password` - Change password (all users)
  - [x] `PUT /api/v1/auth/change-email` - Change email with verification (all users)
  - [x] `DELETE /api/v1/auth/account` - Delete account (cascade delete related data)
  - [x] Privacy settings already available via existing profile update endpoint
  - [x] Add proper authorization checks (user can only modify own settings)
  - [x] Add password confirmation requirement for sensitive operations

- [x] **Testing**
  - [x] Backend API tests: 10/10 tests passing (test-settings-api.sh)
  - [x] Change password with wrong/correct password
  - [x] Change email with wrong/correct password
  - [x] Delete account with wrong/correct password
  - [x] Login with new password after change
  - [x] Account deletion verification

- [x] **Navigation & UX**
  - [x] Settings link added to navbar for both user roles
  - [x] Routes configured for /candidate/settings and /employer/settings
  - [x] Layout wrapper added for proper navigation
  - [x] Tab-based navigation within settings pages
  - [x] Toast notifications for all actions
  - [x] Loading states on buttons
  - [x] Auto-logout after password change (tokens revoked)
  - [x] Auto-redirect after account deletion

### 5. Profile Enhancements ✅ COMPLETE
- [x] **Preferred Contact Information** (Candidate Profiles)
  - [x] Database schema: preferred_first_name, preferred_last_name, email, phone in users table
  - [x] Backend API support in updateCandidateProfile controller
  - [x] Frontend ProfilePage: Editable contact info fields in Basic Information card
  - [x] Display preferred name or fallback to legal name
  - [x] Helper text for "where employers should contact you"
  - [x] Resume parser auto-fill for phone number from uploaded resumes

- [x] **Professional Links** (Candidate Profiles)
  - [x] Database migration 010: professional_links table with link_type, url, label, display_order
  - [x] Supported link types: linkedin, github, portfolio, website, twitter, other
  - [x] Backend API endpoints (Profile Service)
    - [x] POST /api/v1/profiles/candidate/links - Add professional link
    - [x] PUT /api/v1/profiles/candidate/links/:linkId - Update link
    - [x] DELETE /api/v1/profiles/candidate/links/:linkId - Delete link
    - [x] Included in getCandidateProfile response (JSON aggregation)
  - [x] Frontend LinksSection component
    - [x] Display links with icons and labels
    - [x] Add/Edit link modal with type dropdown and URL validation
    - [x] Custom label support (optional)
    - [x] Delete link with confirmation
    - [x] Positioned below Work Experience section
  - [x] Resume parser integration (auto-create links from resume)
    - [x] Extract LinkedIn, GitHub, website URLs from resume contact info
    - [x] Auto-populate professional_links table on resume upload
  - [x] Bug fix: Snake_case to camelCase transformation in getCandidateProfile
    - [x] Backend returns linkId, profileId, linkType (not link_id, profile_id, link_type)
    - [x] Fixes React "key" prop warning in LinksSection component

- [ ] User photo upload for candidate profiles (Future Enhancement)
  - [ ] Add profile_photo_url field to candidate_profiles table
  - [ ] S3 integration for photo storage (similar to resume upload pattern)
  - [ ] Frontend upload component with image preview
  - [ ] Image validation (file type, size limits)
  - [ ] Display photo in profile page, dashboard, and candidate cards

---

## Testing & Quality Assurance

### Test Scripts (Automated)
- [x] test-phase0.sh - Foundation tests (complete)
- [x] test-phase1.sh - All 5 services integration tests (complete)
- [x] Update test-phase1.sh with latest changes ✅
  - [x] Job applications tests (Tests 45-47, 49-51)
  - [x] Enhanced matching algorithm tests (Test 48: browse with scores)
  - [x] Company profile tests (Tests 21-24)
  - [x] Employer dashboard stats (Test 52)
  - **Total: 52 comprehensive integration tests**
- [ ] Create test-frontend-e2e.sh (optional - manual testing sufficient for now)
- [ ] Add Jest integration test suite for Auth Service (CI/CD readiness)

### Manual Testing Checklist
- [ ] **Candidate Flow**:
  - [ ] Register → Login → Complete Profile → Add Skills → Browse Jobs → Apply to Job → View Applications
  - [ ] Test all CRUD operations on profile, education, work experience, skills
  - [ ] Verify match scores calculate correctly
  - [ ] Test application withdrawal
- [ ] **Employer Flow**:
  - [ ] Register → Login → Create Company → Post Job → Add Skills → View Jobs → Calculate Matches → View Candidates → Contact Candidate
  - [ ] Test job status transitions (draft → active → closed)
  - [ ] Verify candidate ranking by match score
  - [ ] Test application review and status updates
- [ ] **Cross-cutting Concerns**:
  - [ ] Test authentication (login, logout, token refresh)
  - [ ] Test authorization (role-based access control)
  - [ ] Test error handling and validation
  - [ ] Test responsive design (mobile, tablet, desktop)

### Performance Review
- [ ] Create PERFORMANCE_ANALYSIS.md document with:
  - [ ] Identified pain points and bottlenecks
  - [ ] Potential solutions (1-2 per issue)
  - [ ] Priority ranking (P0: critical, P1: important, P2: nice-to-have)
  - [ ] Focus areas: database queries, API response times, frontend rendering, matching algorithm

### Documentation Strategy
- [ ] Keep minimal, high-value documentation only:
  - [x] CLAUDE.md - Main guidance for AI assistants (keep updated)
  - [x] DATABASE_SCHEMA.sql - Schema with comments (keep updated)
  - [x] PHASE_1_CHECKLIST.md - Progress tracking (keep updated)
  - [ ] SETUP_INSTRUCTIONS.md - Quick start guide for new developers (one-time creation)
  - [ ] API_ENDPOINTS.md - Quick reference for available endpoints (optional, generated from code)
- [ ] Avoid over-documentation that becomes stale
- [ ] Use inline code comments for complex business logic
- [ ] Keep README.md concise with links to other docs
