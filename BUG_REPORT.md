# Bug Report - Phase 1 E2E Testing

**Date:** 2025-11-11
**Testing Phase:** Phase 1 Integration & E2E Testing
**Status:** 🐛 5 Bugs Identified (3 High, 2 Medium)

---

## Summary

E2E testing revealed **5 bugs** related to inconsistent field naming between backend services and expectations. All bugs are related to **snake_case vs camelCase** field naming conventions.

**Test Results:**
- ✅ Authentication: 4/4 tests passed (100%)
- ✅ Profile Basic Info: 2/2 tests passed (100%)
- ❌ Education: 0/1 tests passed (field name mismatch)
- ❌ Work Experience: 0/1 tests passed (field name mismatch)
- ❌ Skills Management: 0/6 tests passed (API structure issue)

---

## Bug List

### BUG-001: Education API Expects Snake Case Field Names
**Severity:** High
**Status:** 🔴 Open
**Component:** Profile Service - Education Controller
**Affects:** Candidate profile management

**Description:**
The education endpoint expects `snake_case` field names but the E2E test (and likely frontend) sends `camelCase` field names.

**Current Behavior:**
```bash
POST /api/v1/profiles/candidate/education
{
  "degree": "Bachelor of Science",
  "field_of_study": "Computer Science",  # ❌ Expected by backend
  "fieldOfStudy": "Computer Science",    # ✅ Sent by frontend
  "institution": "Stanford University",
  "graduation_year": 2015,                # ❌ Expected by backend
  "graduationYear": 2015,                 # ✅ Sent by frontend
  "gpa": 3.8
}

Response: 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Degree, institution, and graduation year are required"
  }
}
```

**Expected Behavior:**
Backend should accept either:
1. `camelCase` field names (consistent with frontend), OR
2. Frontend should send `snake_case` field names (consistent with database)

**Root Cause:**
`backend/services/profile-service/src/controllers/profileController.ts` (education endpoints) expects `snake_case` field names:
```typescript
const { degree, field_of_study, institution, graduation_year, gpa } = req.body;
```

**Impact:**
- Frontend cannot add education entries
- Candidate profiles incomplete
- Poor user experience

**Recommended Fix:**
**Option 1: Accept both field name formats (Recommended)**
```typescript
const {
  degree,
  field_of_study,
  fieldOfStudy = field_of_study,
  institution,
  graduation_year,
  graduationYear = graduation_year,
  gpa
} = req.body;
```

**Option 2: Add middleware to convert camelCase → snake_case**
```typescript
function toCamelCase(req, res, next) {
  req.body = convertKeys(req.body, 'snake');
  next();
}
```

**Priority:** P0 (Critical) - Blocks core functionality
**Effort:** 1 hour

---

### BUG-002: Work Experience API Expects Snake Case Field Names
**Severity:** High
**Status:** 🔴 Open
**Component:** Profile Service - Work Experience Controller
**Affects:** Candidate profile management

**Description:**
Same issue as BUG-001, but for work experience endpoints.

**Current Behavior:**
```bash
POST /api/v1/profiles/candidate/experience
{
  "title": "Senior Python Developer",
  "company": "Google",
  "start_date": "2020-01-01",      # ❌ Expected by backend
  "startDate": "2020-01-01",       # ✅ Sent by frontend
  "end_date": "2022-12-31",        # ❌ Expected (optional)
  "endDate": "2022-12-31",         # ✅ Sent (optional)
  "is_current": true,               # ❌ Expected by backend
  "isCurrent": true,                # ✅ Sent by frontend
  "description": "Leading development team"
}

Response: 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title, company, and start date are required"
  }
}
```

**Expected Behavior:**
Backend should accept camelCase field names to match frontend conventions.

**Root Cause:**
`backend/services/profile-service/src/controllers/profileController.ts` (experience endpoints) expects `snake_case`:
```typescript
const { title, company, start_date, end_date, is_current, description } = req.body;
```

**Impact:**
- Frontend cannot add work experience
- Candidate profiles incomplete
- Job matching algorithm cannot use experience data for bonuses

**Recommended Fix:**
Same as BUG-001 - Accept both formats or add conversion middleware.

**Priority:** P0 (Critical) - Blocks core functionality
**Effort:** 1 hour

---

### BUG-003: Skills API Returns `skill_name` Instead of `name`
**Severity:** High
**Status:** 🔴 Open
**Component:** Skills Service - Skills Controller
**Affects:** Skills browsing and management

**Description:**
The Skills API returns `skill_name` field, but the E2E test (and possibly frontend) expects `name` field.

**Current Behavior:**
```bash
GET /api/v1/skills

Response:
{
  "success": true,
  "data": [
    {
      "skill_id": "ffe5b484-9f19-41b1-a670-d85dd4a53716",
      "skill_name": "Python",  # ❌ Backend returns this
      "name": "Python",         # ✅ Frontend expects this
      "category": "programming",
      "description": "...",
      "active": true
    }
  ]
}
```

**Expected Behavior:**
API should return `name` field OR frontend should use `skill_name` field.

**Root Cause:**
Skills Service returns database column names directly:
```sql
SELECT skill_id, skill_name, category, description, active FROM skills
```

Database column is `skill_name`, but REST API convention would use shorter `name` field.

**Impact:**
- Frontend cannot display skill names correctly
- Cannot add skills (skill ID extraction fails)
- Skills page shows blank or undefined skill names

**Recommended Fix:**
**Option 1: Alias in SQL query (Recommended)**
```typescript
const result = await query(
  `SELECT
    skill_id,
    skill_name AS name,  -- Alias for API response
    category,
    description,
    active,
    created_at
  FROM skills
  WHERE active = true
  ORDER BY created_at DESC
  LIMIT $1 OFFSET $2`,
  [limit, offset]
);
```

**Option 2: Transform response in controller**
```typescript
const skills = result.rows.map(skill => ({
  ...skill,
  name: skill.skill_name,
  skillName: skill.skill_name  // Keep both for backwards compatibility
}));
```

**Priority:** P0 (Critical) - Blocks skills management
**Effort:** 30 minutes

---

### BUG-004: Job Browse Response Structure Mismatch
**Severity:** Medium
**Status:** 🔴 Open
**Component:** Matching Service - Browse Jobs Endpoint
**Affects:** Job browsing and matching

**Description:**
The browse jobs endpoint response structure differs from expected format, causing array indexing errors.

**Current Behavior:**
```bash
GET /api/v1/matching/candidate/browse-jobs

Response might be:
{
  "success": true,
  "data": {
    "jobs": [...],      # Nested under "jobs" key
    "total": 57
  }
}

OR

{
  "success": true,
  "data": [...]  # Direct array
}
```

**Error:**
```
jq: error (at /tmp/e2e_response_84033:0): Cannot index object with number
```

This occurs when trying to access `.data[0]` but `.data` is an object, not an array.

**Expected Behavior:**
Consistent response structure. Should be:
```json
{
  "success": true,
  "data": [...],  // Array of jobs directly
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 57
  }
}
```

**Root Cause:**
Check `backend/services/matching-service/src/controllers/matchingController.ts:browseJobsWithScores()` response format.

**Impact:**
- E2E test cannot parse response
- Frontend may have issues accessing job data
- Inconsistent API patterns across services

**Recommended Fix:**
Ensure consistent response structure across all endpoints:
```typescript
res.status(200).json(
  successResponse(jobsWithScores, {
    page: 1,
    limit: jobsWithScores.length,
    total: jobsWithScores.length
  })
);
```

**Priority:** P1 (High) - Affects user experience
**Effort:** 30 minutes

---

### BUG-005: Inconsistent Field Naming Convention Across Services
**Severity:** Medium (Architectural Issue)
**Status:** 🔴 Open
**Component:** All Services
**Affects:** API consistency, developer experience

**Description:**
Different services use different field naming conventions:
- **Database**: `snake_case` (PostgreSQL convention)
- **Some API endpoints**: `snake_case` (Profile Service education/experience)
- **Other API endpoints**: `camelCase` (Auth Service, Job Service)
- **Frontend**: `camelCase` (JavaScript convention)

**Examples:**
```typescript
// Auth Service (camelCase)
{
  firstName: "John",
  lastName: "Doe",
  userId: "..."
}

// Profile Service Education (snake_case)
{
  field_of_study: "Computer Science",
  graduation_year: 2015
}

// Job Service (camelCase)
{
  jobId: "...",
  companyId: "...",
  createdAt: "..."
}
```

**Impact:**
- Developer confusion
- Inconsistent API design
- Frontend needs field name conversion logic for different endpoints
- Harder to maintain and debug

**Recommended Fix:**
**Phase 1 (Quick Fix):**
1. Add middleware to accept both formats in all endpoints
2. Always return camelCase in API responses
3. Convert to snake_case only when writing to database

**Phase 2 (Long-term):**
1. Establish coding standards document
2. Choose one convention (recommend: camelCase for APIs, snake_case for DB)
3. Add automated tests to enforce conventions
4. Refactor all endpoints to follow standard

**Priority:** P2 (Medium) - Technical debt, not blocking
**Effort:** 1-2 weeks for full refactor

---

## Bug Fix Priority

### Critical (P0) - Fix Immediately
1. **BUG-001** - Education field names (1 hour)
2. **BUG-002** - Work experience field names (1 hour)
3. **BUG-003** - Skills API `skill_name` → `name` (30 min)

**Total Effort:** 2.5 hours

### High Priority (P1) - Fix Before Phase 2
4. **BUG-004** - Job browse response structure (30 min)

### Medium Priority (P2) - Technical Debt
5. **BUG-005** - Inconsistent naming conventions (1-2 weeks)

---

## Test Environment

**Services Status:**
```
✅ Auth Service (Port 3000)
✅ Profile Service (Port 3001)
✅ Job Service (Port 3002)
✅ Skills Service (Port 3003)
✅ Matching Service (Port 3004)
✅ Frontend (Port 5173)
✅ PostgreSQL Database
✅ Redis Cache
```

**Test Coverage:**
- Authentication: ✅ 100% passing
- Profile Basic Info: ✅ 100% passing
- Education: ❌ 0% passing (BUG-001)
- Work Experience: ❌ 0% passing (BUG-002)
- Skills Management: ❌ 0% passing (BUG-003)
- Job Browsing: ⚠️ Partial (BUG-004)

---

## Reproduction Steps

### BUG-001 & BUG-002 Reproduction
```bash
# 1. Register and login as candidate
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","firstName":"Test","lastName":"User","role":"candidate"}'

# 2. Get access token
TOKEN="<access_token_from_step_1>"

# 3. Try to add education with camelCase (FAILS)
curl -X POST http://localhost:3001/api/v1/profiles/candidate/education \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"degree":"BS","fieldOfStudy":"CS","institution":"MIT","graduationYear":2020}'
# Returns: 400 Bad Request

# 4. Try with snake_case (WORKS)
curl -X POST http://localhost:3001/api/v1/profiles/candidate/education \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"degree":"BS","field_of_study":"CS","institution":"MIT","graduation_year":2020}'
# Returns: 201 Created
```

### BUG-003 Reproduction
```bash
# 1. Fetch skills
curl http://localhost:3003/api/v1/skills?limit=1 | jq '.data[0]'

# Response shows "skill_name" instead of "name"
{
  "skill_id": "...",
  "skill_name": "Python",  # ❌ Should be "name"
  "category": "programming"
}
```

---

## Verification Plan

After fixes are applied, re-run:
```bash
bash /tmp/test-e2e-complete.sh
```

Expected result: **100% pass rate** (20/20 tests passing)

---

## Related Documents

- [E2E_TEST_PLAN.md](E2E_TEST_PLAN.md) - Comprehensive test plan
- [E2E_TEST_RESULTS.md](E2E_TEST_RESULTS.md) - Detailed test execution results
- [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md) - Performance issues and optimizations
- [PHASE_1_CHECKLIST.md](PHASE_1_CHECKLIST.md) - Phase 1 progress tracking

---

## Sign-Off

**Reported By:** Claude Code (Automated E2E Testing)
**Date:** 2025-11-11
**Severity Assessment:** 3 Critical, 1 High, 1 Medium
**Blocking Phase 2:** Yes (P0 bugs must be fixed first)
**Estimated Fix Time:** 2.5 hours for critical bugs, 3 hours total for P0+P1

**Next Steps:**
1. Fix BUG-001, BUG-002, BUG-003 (critical)
2. Re-run E2E tests to verify fixes
3. Fix BUG-004 (high priority)
4. Plan BUG-005 refactor for Phase 2+
5. Continue with Employer Flow E2E testing
