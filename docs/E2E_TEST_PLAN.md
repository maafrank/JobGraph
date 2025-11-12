# End-to-End Testing Plan - JobGraph Phase 1

**Date:** 2025-11-11
**Status:** Phase 1 Integration & Testing
**Purpose:** Comprehensive manual testing of all user flows to ensure complete functionality before Phase 2

---

## Test Environment Setup

### Prerequisites
- [ ] All Docker services running (PostgreSQL, Redis, Adminer)
- [ ] Database seeded with test data
- [ ] All 5 backend services running:
  - Auth Service (Port 3000)
  - Profile Service (Port 3001)
  - Job Service (Port 3002)
  - Skills Service (Port 3003)
  - Matching Service (Port 3004)
- [ ] Frontend running (Port 5173)
- [ ] Test credentials available (from seed-test-users.ts)

### Test Data Available
```
Candidate Test Users:
- alice.johnson@example.com / Password123!
- bob.smith@example.com / Password123!
- charlie.davis@example.com / Password123!

Employer Test Users:
- john.recruiter@techcorp.com / Password123!
- sarah.hr@innovate.com / Password123!
```

---

## Test Execution Strategy

### Testing Approach
1. **Manual Testing:** Execute all flows manually through the UI
2. **Documentation:** Record results, issues, and observations
3. **Bug Tracking:** Document bugs in separate section with severity
4. **Screenshots:** Optional but helpful for major issues

### Pass/Fail Criteria
- ✅ **PASS:** Feature works as expected, no errors, good UX
- ⚠️ **PARTIAL:** Feature works but has minor issues (non-blocking)
- ❌ **FAIL:** Feature broken, error thrown, or blocking issue

---

## Test Suite 1: Candidate Complete Flow

### 1.1 Registration & Authentication
**Objective:** Verify new candidate can register and log in

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.1.1 | Navigate to `/register` | Registration page loads | | |
| 1.1.2 | Select "Candidate" role | Role highlights, form shows | | |
| 1.1.3 | Enter valid email and password | Form accepts input | | |
| 1.1.4 | Submit registration | Success toast, redirect to `/candidate/dashboard` | | |
| 1.1.5 | Verify auto-created profile | Profile exists in database | | |
| 1.1.6 | Logout | Redirect to homepage | | |
| 1.1.7 | Login with same credentials | Success, redirect to dashboard | | |
| 1.1.8 | Refresh page | Stay logged in (token persists) | | |
| 1.1.9 | Try to register duplicate email | Error: "Email already exists" | | |
| 1.1.10 | Try weak password (e.g., "abc") | Validation error shown | | |

**Test Data:**
- Email: `test.candidate.{timestamp}@example.com`
- Password: `TestPass123!`

---

### 1.2 Candidate Dashboard
**Objective:** Verify dashboard displays correct stats and navigation works

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.2.1 | View dashboard after login | Dashboard loads with stats | | |
| 1.2.2 | Check profile completion % | Shows 0-20% (new profile) | | |
| 1.2.3 | Check skills count | Shows 0 skills | | |
| 1.2.4 | Check job matches count | Shows 0 matches | | |
| 1.2.5 | Verify Getting Started checklist | 4 items, none checked | | |
| 1.2.6 | Click "Complete Profile" button | Navigate to `/candidate/profile` | | |
| 1.2.7 | Click "Add Skills" button | Navigate to `/candidate/skills` | | |
| 1.2.8 | Click "Browse Jobs" button | Navigate to `/candidate/job-matches` | | |

---

### 1.3 Profile Management
**Objective:** Complete CRUD operations on candidate profile

#### 1.3.1 Basic Profile Information
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.3.1.1 | Navigate to `/candidate/profile` | Profile page loads | | |
| 1.3.1.2 | Enter headline | "Senior Python Developer" | | |
| 1.3.1.3 | Enter summary | Multi-line text accepted | | |
| 1.3.1.4 | Enter location (city, state) | "San Francisco, CA" | | |
| 1.3.1.5 | Set years of experience | Select "5-7 years" | | |
| 1.3.1.6 | Set remote preference | Select "Remote" | | |
| 1.3.1.7 | Check "Willing to relocate" | Checkbox checked | | |
| 1.3.1.8 | Set profile visibility | Select "Public" | | |
| 1.3.1.9 | Click "Save Changes" | Success toast, profile updated | | |
| 1.3.1.10 | Refresh page | Data persists | | |

#### 1.3.2 Education Management
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.3.2.1 | Click "Add Education" button | Modal opens | | |
| 1.3.2.2 | Enter degree | "Bachelor of Science" | | |
| 1.3.2.3 | Enter field of study | "Computer Science" | | |
| 1.3.2.4 | Enter institution | "Stanford University" | | |
| 1.3.2.5 | Enter graduation year | "2015" | | |
| 1.3.2.6 | Enter GPA | "3.8" | | |
| 1.3.2.7 | Click "Save" | Modal closes, education appears | | |
| 1.3.2.8 | Add second education | "Master of Science, MIT, 2017" | | |
| 1.3.2.9 | Click "Edit" on first education | Modal pre-filled with data | | |
| 1.3.2.10 | Update GPA to "3.9" | Update saved, reflected in list | | |
| 1.3.2.11 | Click "Delete" on second education | Confirmation prompt shown | | |
| 1.3.2.12 | Confirm deletion | Education removed from list | | |

#### 1.3.3 Work Experience Management
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.3.3.1 | Click "Add Work Experience" | Modal opens | | |
| 1.3.3.2 | Enter job title | "Senior Python Developer" | | |
| 1.3.3.3 | Enter company | "Google" | | |
| 1.3.3.4 | Enter start date | "2020-01" | | |
| 1.3.3.5 | Check "Current position" | End date disabled | | |
| 1.3.3.6 | Enter description | Multi-line text | | |
| 1.3.3.7 | Click "Save" | Modal closes, experience appears | | |
| 1.3.3.8 | Add second experience | "Python Developer, Facebook, 2018-2020" | | |
| 1.3.3.9 | Verify sorting | Most recent first | | |
| 1.3.3.10 | Edit first experience | Update description | | |
| 1.3.3.11 | Delete second experience | Removed from list | | |

---

### 1.4 Skills Management
**Objective:** Test complete skill score CRUD operations

#### 1.4.1 Browse & Add Skills
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.4.1.1 | Navigate to `/candidate/skills` | Skills page loads, "My Skills" tab active | | |
| 1.4.1.2 | Verify "My Skills" shows empty state | "No skills added yet" message | | |
| 1.4.1.3 | Click "Browse Skills" tab | Shows all skills with categories | | |
| 1.4.1.4 | Verify skill count | 35+ skills displayed | | |
| 1.4.1.5 | Filter by "programming" category | Only programming skills shown | | |
| 1.4.1.6 | Search for "Python" | Only Python skill shown | | |
| 1.4.1.7 | Clear filters | All skills shown again | | |
| 1.4.1.8 | Click "Add" on Python skill | Add skill modal opens | | |
| 1.4.1.9 | Drag slider to 85 | Score shows 85, "Expert" label | | |
| 1.4.1.10 | Verify color indicator | Green color (80-100 range) | | |
| 1.4.1.11 | Click "Save" | Success toast, modal closes | | |
| 1.4.1.12 | Click "My Skills" tab | Python skill appears in list | | |
| 1.4.1.13 | Verify skill details | Score 85, category badge, expiry date (1 year) | | |

#### 1.4.2 Edit & Delete Skills
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.4.2.1 | Add 3 more skills | JavaScript (75), React (70), Node.js (80) | | |
| 1.4.2.2 | Verify skill count in dashboard | Shows 4 skills | | |
| 1.4.2.3 | Click "Edit" on Python | Modal opens with score 85 | | |
| 1.4.2.4 | Change score to 90 | Slider updates, "Expert" label | | |
| 1.4.2.5 | Click "Save" | Updated score displayed | | |
| 1.4.2.6 | Try to add Python again | Info toast: "Already added" | | |
| 1.4.2.7 | Click "Delete" on Node.js | Confirmation prompt | | |
| 1.4.2.8 | Confirm deletion | Skill removed, count updates to 3 | | |

---

### 1.5 Job Matches & Browsing
**Objective:** Test job discovery and match score calculation

#### 1.5.1 Browse All Jobs
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.5.1.1 | Navigate to `/candidate/job-matches` | Job matches page loads | | |
| 1.5.1.2 | Verify jobs are displayed | List of jobs with match scores | | |
| 1.5.1.3 | Check match score badges | Color-coded (green/blue/yellow/red) | | |
| 1.5.1.4 | Verify qualification status | "Fully Qualified" or "X/Y Required Skills Met" | | |
| 1.5.1.5 | Check default sorting | Sorted by match score (highest first) | | |
| 1.5.1.6 | Filter by "Remote Only" | Only remote jobs shown | | |
| 1.5.1.7 | Filter by "Fully Qualified" | Only jobs where all requirements met | | |
| 1.5.1.8 | Change sort to "Recently Posted" | Jobs reorder by date | | |
| 1.5.1.9 | Clear all filters | All jobs shown again | | |

#### 1.5.2 View Job Details
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.5.2.1 | Click "View Details" on top match | Job detail modal opens | | |
| 1.5.2.2 | Verify job information | Title, description, salary, location shown | | |
| 1.5.2.3 | Check "Required Skills" section | Shows skills needed with thresholds | | |
| 1.5.2.4 | Check skill score bars | Visual progress bars for each skill | | |
| 1.5.2.5 | Verify color coding | Green (meets), Red (missing/below) | | |
| 1.5.2.6 | Check "Optional Skills" section | Bonus skills shown separately | | |
| 1.5.2.7 | Verify skill weights | "Weight: 40%" displayed | | |
| 1.5.2.8 | Close modal | Returns to job list | | |

#### 1.5.3 Apply to Jobs
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.5.3.1 | Click "Apply" on a job | Apply modal opens | | |
| 1.5.3.2 | Leave cover letter empty | Optional field | | |
| 1.5.3.3 | Click "Submit Application" | Success toast, modal closes | | |
| 1.5.3.4 | Verify "Applied" badge | Shows on job card | | |
| 1.5.3.5 | Try to apply again | Button disabled or error toast | | |
| 1.5.3.6 | Apply to second job with cover letter | Enter text, submit | | |
| 1.5.3.7 | Verify application saved | Cover letter stored | | |

---

### 1.6 My Applications
**Objective:** Test application tracking and management

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 1.6.1 | Navigate to `/candidate/applications` | Applications page loads | | |
| 1.6.2 | Verify applied jobs shown | 2 applications from previous test | | |
| 1.6.3 | Check application status | Both show "Submitted" status | | |
| 1.6.4 | Verify match scores | Scores displayed if calculated | | |
| 1.6.5 | Filter by "Submitted" status | Both shown | | |
| 1.6.6 | Filter by "Accepted" status | Empty state | | |
| 1.6.7 | Click on first application | Details modal opens | | |
| 1.6.8 | Verify modal content | Cover letter, timeline, job details | | |
| 1.6.9 | Close modal | Returns to list | | |
| 1.6.10 | Click "Withdraw" on second application | Confirmation prompt | | |
| 1.6.11 | Confirm withdrawal | Status changes to "Withdrawn" | | |
| 1.6.12 | Try to withdraw again | Button disabled (already withdrawn) | | |

---

## Test Suite 2: Employer Complete Flow

### 2.1 Registration & Authentication
**Objective:** Verify employer registration and login

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.1.1 | Navigate to `/register` | Registration page loads | | |
| 2.1.2 | Select "Employer" role | Form shows employer fields | | |
| 2.1.3 | Enter valid email and password | Form accepts input | | |
| 2.1.4 | Submit registration | Success, redirect to `/employer/dashboard` | | |
| 2.1.5 | Verify no company exists | Dashboard shows "Get Started" guide | | |
| 2.1.6 | Logout and login | Can log back in successfully | | |

**Test Data:**
- Email: `test.employer.{timestamp}@example.com`
- Password: `TestPass123!`

---

### 2.2 Employer Dashboard
**Objective:** Verify dashboard displays correct initial state

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.2.1 | View dashboard after login | Dashboard loads | | |
| 2.2.2 | Check active jobs count | Shows 0 | | |
| 2.2.3 | Check total matches | Shows 0 | | |
| 2.2.4 | Check contacted candidates | Shows 0 | | |
| 2.2.5 | Verify "Getting Started" guide | Shows steps to create company | | |
| 2.2.6 | Click "Create Company Profile" | Navigate to company profile page | | |

---

### 2.3 Company Profile Management
**Objective:** Test company profile creation and updates

#### 2.3.1 First-Time Setup
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.3.1.1 | Navigate to `/employer/company` | Page loads in edit mode (no company) | | |
| 2.3.1.2 | Enter company name | "TechCorp Solutions" | | |
| 2.3.1.3 | Enter description | Multi-line company description | | |
| 2.3.1.4 | Select industry | "Technology" | | |
| 2.3.1.5 | Select company size | "51-200 employees" | | |
| 2.3.1.6 | Enter website | "https://techcorp.example.com" | | |
| 2.3.1.7 | Enter location | "New York, NY, USA" | | |
| 2.3.1.8 | Click "Save Changes" | Success toast, switches to view mode | | |
| 2.3.1.9 | Verify data displayed | All fields shown correctly | | |
| 2.3.1.10 | Check metadata | Created date displayed | | |

#### 2.3.2 Edit Company Profile
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.3.2.1 | Click "Edit Company" button | Switches to edit mode | | |
| 2.3.2.2 | Update description | New text accepted | | |
| 2.3.2.3 | Change company size | "201-500 employees" | | |
| 2.3.2.4 | Click "Save Changes" | Success toast, updates displayed | | |
| 2.3.2.5 | Refresh page | Changes persist | | |

---

### 2.4 Job Posting
**Objective:** Test complete job creation with skills

#### 2.4.1 Create New Job
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.4.1.1 | Navigate to `/employer/jobs/new` | Job posting form loads | | |
| 2.4.1.2 | Enter job title | "Senior Python Developer" | | |
| 2.4.1.3 | Enter description | Multi-line job description | | |
| 2.4.1.4 | Enter requirements | Bullet points accepted | | |
| 2.4.1.5 | Enter responsibilities | Multi-line text | | |
| 2.4.1.6 | Enter location | "San Francisco, CA, USA" | | |
| 2.4.1.7 | Select remote option | "Remote" | | |
| 2.4.1.8 | Select employment type | "Full-time" | | |
| 2.4.1.9 | Select experience level | "Senior" | | |
| 2.4.1.10 | Enter salary range | Min: 120000, Max: 180000 | | |
| 2.4.1.11 | Select currency | "USD" | | |

#### 2.4.2 Add Required Skills
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.4.2.1 | Click "Add Skill" button | Skill modal opens | | |
| 2.4.2.2 | Select skill | "Python" from dropdown | | |
| 2.4.2.3 | Set as "Required" | Toggle on | | |
| 2.4.2.4 | Set weight to 40% | Slider at 40 | | |
| 2.4.2.5 | Set minimum score to 80 | Slider at 80, "Advanced" label | | |
| 2.4.2.6 | Verify color indicator | Blue/green for advanced | | |
| 2.4.2.7 | Click "Save" | Skill added to "Required Skills" section | | |
| 2.4.2.8 | Add second skill | "Django, Required, Weight: 30%, Min: 75" | | |
| 2.4.2.9 | Add third skill | "PostgreSQL, Required, Weight: 20%, Min: 70" | | |
| 2.4.2.10 | Verify weights total | Shows ~90% (close to 100%) | | |

#### 2.4.3 Add Optional Skills
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.4.3.1 | Click "Add Skill" button | Modal opens | | |
| 2.4.3.2 | Select skill | "React" | | |
| 2.4.3.3 | Set as "Optional" | Toggle off | | |
| 2.4.3.4 | Set weight to 10% | Slider at 10 | | |
| 2.4.3.5 | Set minimum score to 60 | Slider at 60 | | |
| 2.4.3.6 | Click "Save" | Skill added to "Optional Skills" section | | |

#### 2.4.4 Save & Publish Job
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.4.4.1 | Click "Save as Draft" | Success toast, job saved with status "draft" | | |
| 2.4.4.2 | Verify redirect | Navigate to job management page | | |
| 2.4.4.3 | Go back to job posting form | Edit the draft job | | |
| 2.4.4.4 | Click "Publish" | Job status changes to "active" | | |
| 2.4.4.5 | Verify job appears in listings | Public job list includes it | | |

#### 2.4.5 Edit Existing Job
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.4.5.1 | Navigate to job edit page | Form pre-filled with job data | | |
| 2.4.5.2 | Verify skills loaded | All 4 skills shown with correct data | | |
| 2.4.5.3 | Edit a required skill | Change Python weight to 35% | | |
| 2.4.5.4 | Remove an optional skill | Delete React skill | | |
| 2.4.5.5 | Add new optional skill | "AWS, Optional, 10%, Min: 65" | | |
| 2.4.5.6 | Update job description | New text entered | | |
| 2.4.5.7 | Click "Publish" | Updates saved | | |
| 2.4.5.8 | Verify changes | All updates reflected | | |

---

### 2.5 Job Management
**Objective:** Test job listing, filtering, and status management

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.5.1 | Navigate to `/employer/jobs` | Job management page loads | | |
| 2.5.2 | Verify job listed | Created job appears | | |
| 2.5.3 | Check job details | Title, status, salary, location shown | | |
| 2.5.4 | Click "All Jobs" tab | Shows all jobs | | |
| 2.5.5 | Click "Active" tab | Shows only active jobs | | |
| 2.5.6 | Click "Draft" tab | Shows only draft jobs | | |
| 2.5.7 | Create second job as draft | New job in draft status | | |
| 2.5.8 | Click "Publish" on draft job | Status changes to active | | |
| 2.5.9 | Click "Close Job" on first job | Status changes to closed | | |
| 2.5.10 | Verify closed job in "Closed" tab | Appears in closed filter | | |
| 2.5.11 | Click "Reopen Job" | Status returns to active | | |
| 2.5.12 | Check match count | Shows "0 matches" initially | | |
| 2.5.13 | Wait for auto-calculate | Matches calculated for active jobs | | |
| 2.5.14 | Verify match count updated | Shows actual number of matches | | |
| 2.5.15 | Click "View Candidates" | Navigate to candidates page | | |

---

### 2.6 Candidate Matches & Management
**Objective:** Test viewing and managing matched candidates

#### 2.6.1 View Matched Candidates
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.6.1.1 | On candidates page | Ranked candidates displayed | | |
| 2.6.1.2 | Verify match scores | Color-coded badges (green/blue/yellow) | | |
| 2.6.1.3 | Verify ranking | #1, #2, #3... in order | | |
| 2.6.1.4 | Check candidate info | Name, headline, location, experience | | |
| 2.6.1.5 | Check skill breakdown | Skills with scores shown | | |
| 2.6.1.6 | Verify skill colors | Green (meets), Red (below threshold) | | |

#### 2.6.2 Filter Candidates
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.6.2.1 | Click "All" tab | Shows all matches | | |
| 2.6.2.2 | Click "Applied" tab | Shows only candidates who applied | | |
| 2.6.2.3 | Click "Matched Only" tab | Shows only auto-matched candidates | | |
| 2.6.2.4 | Verify counts | Candidate count updates per filter | | |

#### 2.6.3 View Candidate Application
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.6.3.1 | Find candidate with "Applied" badge | Has 📝 badge | | |
| 2.6.3.2 | Click "View Application" button | Application modal opens | | |
| 2.6.3.3 | Verify cover letter | Text displayed if provided | | |
| 2.6.3.4 | Check candidate profile | Headline, summary shown | | |
| 2.6.3.5 | Check match score | Score and rank displayed | | |
| 2.6.3.6 | Check skill breakdown | Full skill details with scores | | |
| 2.6.3.7 | Check timeline | Applied date, reviewed date shown | | |
| 2.6.3.8 | Update application status | Change to "Under Review" | | |
| 2.6.3.9 | Verify status updated | Badge changes color/text | | |
| 2.6.3.10 | Close modal | Returns to candidates list | | |

#### 2.6.4 Contact & Manage Candidates
| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 2.6.4.1 | Click "Contact" on a candidate | Status updates to "Contacted" | | |
| 2.6.4.2 | Verify contacted badge | Shows 🎯 badge | | |
| 2.6.4.3 | Check contacted date | Timestamp displayed | | |
| 2.6.4.4 | Update match status | Change to "Shortlisted" | | |
| 2.6.4.5 | Verify status dropdown | Shows all valid statuses | | |
| 2.6.4.6 | Update to "Interviewing" | Status badge updates | | |
| 2.6.4.7 | Update to "Rejected" | Status changes | | |
| 2.6.4.8 | Find different candidate | Update to "Hired" | | |

---

## Test Suite 3: Cross-Functional Flows

### 3.1 Complete Job Matching Flow
**Objective:** Test end-to-end matching from job creation to candidate viewing

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 3.1.1 | **Employer:** Create job with Python (80), Django (75), PostgreSQL (70) | Job published | | |
| 3.1.2 | **Candidate:** Add skills: Python (85), Django (80), PostgreSQL (75) | All skills added | | |
| 3.1.3 | **Employer:** Trigger match calculation | Matches calculated | | |
| 3.1.4 | **Employer:** View candidates | Candidate appears in list | | |
| 3.1.5 | Verify match score | High score (85%+) due to meeting all requirements | | |
| 3.1.6 | **Candidate:** Browse jobs | Job appears in matches | | |
| 3.1.7 | Verify match score | Same score on candidate side | | |
| 3.1.8 | Verify qualification status | Shows "Fully Qualified" | | |

### 3.2 Partial Match Scenario
**Objective:** Test matching when candidate doesn't meet all requirements

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 3.2.1 | **Employer:** Create job requiring Python (80), React (75), AWS (70) | Job published | | |
| 3.2.2 | **Candidate:** Has only Python (85) and React (60) | Missing AWS, React below threshold | | |
| 3.2.3 | **Employer:** Calculate matches | Candidate NOT in auto-matched list | | |
| 3.2.4 | **Candidate:** Browse jobs | Job still shows in browse list | | |
| 3.2.5 | Verify match score | Lower score (40-60%) with penalty | | |
| 3.2.6 | Verify qualification status | "2/3 Required Skills Met" | | |
| 3.2.7 | View skill breakdown | Red badges for missing/below skills | | |

### 3.3 Application + Match Integration
**Objective:** Test how applications interact with matches

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 3.3.1 | **Candidate:** Apply to job (not auto-matched) | Application submitted | | |
| 3.3.2 | **Employer:** Calculate matches | Matches calculated | | |
| 3.3.3 | **Employer:** View candidates in "All" tab | Both matched AND applied candidates shown | | |
| 3.3.4 | **Employer:** View candidates in "Applied" tab | Only applied candidate shown | | |
| 3.3.5 | Verify source badge | "✓ Applied" or "✓ Applied & Matched" | | |
| 3.3.6 | Verify dual badges | Has both 📝 (application) and 🎯 (match) badges | | |
| 3.3.7 | **Employer:** Update application status | Can manage application | | |
| 3.3.8 | **Employer:** Update match status | Can manage match independently | | |

---

## Test Suite 4: Authorization & Security

### 4.1 Authentication & Authorization
**Objective:** Verify proper access control

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 4.1.1 | Try to access `/candidate/profile` without login | Redirect to `/login` | | |
| 4.1.2 | Login as candidate, try to access `/employer/jobs` | 403 Forbidden or redirect | | |
| 4.1.3 | Login as employer, try to access `/candidate/profile` | 403 Forbidden or redirect | | |
| 4.1.4 | Candidate tries to edit another's profile | 403 Forbidden error | | |
| 4.1.5 | Employer tries to edit another company's job | 403 Forbidden error | | |
| 4.1.6 | Token expires after 15 minutes | Auto-refresh or prompt login | | |
| 4.1.7 | Refresh token works | New access token obtained | | |
| 4.1.8 | Logout clears tokens | Cannot access protected routes | | |

### 4.2 Data Validation
**Objective:** Verify input validation and error handling

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 4.2.1 | Submit empty required fields | Validation errors shown | | |
| 4.2.2 | Enter invalid email format | Email validation error | | |
| 4.2.3 | Enter negative salary | Validation error | | |
| 4.2.4 | Add skill with score > 100 | Validation error or capped at 100 | | |
| 4.2.5 | Create job with weights > 100% total | Warning or normalization | | |
| 4.2.6 | Try to apply to closed job | Error: "Job is closed" | | |
| 4.2.7 | Upload resume > 10MB | Error: "File too large" | | |

---

## Test Suite 5: Performance & UX

### 5.1 Page Load Performance
**Objective:** Verify acceptable load times

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 5.1.1 | Measure login page load | < 2 seconds | | |
| 5.1.2 | Measure dashboard load | < 3 seconds | | |
| 5.1.3 | Measure job matches page (100 jobs) | < 5 seconds | | |
| 5.1.4 | Measure candidate matches page | < 3 seconds | | |
| 5.1.5 | Measure profile page with data | < 2 seconds | | |

### 5.2 User Experience
**Objective:** Verify smooth UX and no major issues

| Step | Action | Expected Result | Status | Notes |
|------|--------|----------------|--------|-------|
| 5.2.1 | Check all buttons have hover states | Visual feedback on hover | | |
| 5.2.2 | Check loading spinners appear | Shows during async operations | | |
| 5.2.3 | Check toast notifications | Appear and auto-dismiss | | |
| 5.2.4 | Check modal backdrop click | Closes modal | | |
| 5.2.5 | Check form field focus styles | Clear focus indicators | | |
| 5.2.6 | Check empty states | Helpful messages and CTAs | | |
| 5.2.7 | Test responsive design (mobile) | Layout adapts properly | | |

---

## Bug Tracking Template

### Bug Report Format
```
Bug ID: BUG-001
Severity: [Critical / High / Medium / Low]
Component: [Auth / Profile / Jobs / Skills / Matching / Frontend]
Title: [Brief description]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Result: [What should happen]
Actual Result: [What actually happens]
Error Message: [If any]
Browser/Environment: [Chrome 120, Firefox 115, etc.]
Test User: [Email of test account]

Screenshots: [If applicable]
Priority: [P0 / P1 / P2]
Status: [New / In Progress / Fixed / Verified]
```

---

## Test Summary Report

### Execution Summary
- **Test Suites:** 5
- **Total Test Cases:** ~150
- **Executed:** [ ] / 150
- **Passed:** [ ]
- **Failed:** [ ]
- **Skipped:** [ ]

### Pass Rate
- **Overall:** [ ]%
- **Critical Flows:** [ ]%
- **Candidate Flow:** [ ]%
- **Employer Flow:** [ ]%

### Bugs Found
- **P0 (Critical):** [ ]
- **P1 (High):** [ ]
- **P2 (Medium):** [ ]
- **P3 (Low):** [ ]

### Test Environment
- **Date Tested:** [Date]
- **Tester:** [Name]
- **Services Version:** Phase 1 MVP
- **Database:** PostgreSQL with seeded test data
- **Browser:** [Browser name and version]

---

## Next Steps After Testing

1. **Review all bug reports** and prioritize fixes
2. **Fix P0 bugs** immediately (blocking issues)
3. **Fix P1 bugs** before Phase 2 (high priority)
4. **Document P2 bugs** to address later
5. **Re-test fixed bugs** to verify resolution
6. **Update Phase 1 checklist** with test results
7. **Prepare Phase 2 planning** based on learnings

---

## Sign-Off

**Test Completed By:** __________________
**Date:** __________________
**Overall Status:** [ ] Pass / [ ] Pass with Minor Issues / [ ] Fail
**Ready for Production:** [ ] Yes / [ ] No / [ ] With Reservations

**Notes:**
```
[Add any final observations, recommendations, or concerns]
```
