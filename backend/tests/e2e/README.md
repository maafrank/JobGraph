# End-to-End Tests

This directory contains automated end-to-end test scripts that validate complete user flows through the JobGraph platform.

## Test Scripts

### test-candidate-flow.sh
**Tests:** 20 comprehensive tests covering the complete candidate journey

**Flow:**
1. **Registration & Authentication** (4 tests)
   - Register new candidate with validation
   - Login with credentials
   - Duplicate email prevention
   - Weak password rejection

2. **Profile Management** (4 tests)
   - Get initial profile
   - Update basic info (headline, summary, location, etc.)
   - Add education entry
   - Add work experience entry

3. **Skills Management** (6 tests)
   - Browse all skills (public endpoint)
   - Add Python skill (score 85)
   - Add Django skill (score 80)
   - Add PostgreSQL skill (score 75)
   - Get my skills list
   - Duplicate skill prevention

4. **Job Matches** (2 tests)
   - Browse all jobs with calculated match scores
   - Verify match score calculation

5. **Job Applications** (4 tests)
   - Apply to job without cover letter
   - Get my applications
   - Duplicate application prevention
   - Withdraw application

**Expected Result:** 20/20 tests passing (100%)

---

### test-employer-flow.sh
**Tests:** 13 comprehensive tests covering the complete employer journey

**Flow:**
1. **Registration & Authentication** (2 tests)
   - Register new employer with company name (auto-creates company)
   - Login with credentials

2. **Company Profile Management** (2 tests)
   - Get auto-created company profile
   - Update company profile

3. **Job Posting** (4 tests)
   - Create new job posting
   - Add required skill: Python (weight 40%, min score 80)
   - Add required skill: Django (weight 30%, min score 75)
   - Add optional skill: React (weight 15%, min score 60)

4. **Job Management** (2 tests)
   - List my jobs
   - Get job details

5. **Matching & Candidate Management** (3 tests)
   - Calculate matches for job
   - View matched candidates
   - Contact candidate (skipped if no matches)

**Expected Result:** 13/13 tests passing (100%)

---

## Prerequisites

Before running E2E tests, ensure:

1. **Docker services are running:**
   ```bash
   docker-compose up -d
   ```

2. **Database is seeded:**
   ```bash
   ./scripts/setup-database.sh
   ```

3. **All backend services are running:**
   ```bash
   # Option 1: Use dev-services script (recommended)
   ./dev-services.sh

   # Option 2: Start services individually
   cd backend
   npm run dev:auth      # Port 3000
   npm run dev:profile   # Port 3001
   npm run dev:job       # Port 3002
   npm run dev:skill     # Port 3003
   npm run dev:matching  # Port 3004
   ```

4. **Frontend is running (optional, for manual testing):**
   ```bash
   cd frontend
   npm run dev           # Port 5173
   ```

---

## Running Tests

### Run Individual Test Suites

```bash
# Candidate flow (20 tests)
./backend/tests/e2e/test-candidate-flow.sh

# Employer flow (13 tests)
./backend/tests/e2e/test-employer-flow.sh
```

### Run All E2E Tests

```bash
# Run complete E2E test suite
./backend/tests/e2e/run-all.sh
```

---

## Test Output

### Successful Run
```
======================================
E2E Test: Complete Candidate Flow
======================================

Test 1: 1.1.1 - Register new candidate
✓ PASS

Test 2: 1.1.2 - Login with credentials
✓ PASS

...

======================================
Test Results Summary
======================================
Total Tests: 20
Passed: 20
Failed: 0
Pass Rate: 100.0%
✓ EXCELLENT
```

### Failed Test
```
Test 5: 1.3.1 - Get initial candidate profile
✗ FAIL: HTTP 401

======================================
Failed Tests:
======================================
✗ Test 5: Get profile - HTTP 401

======================================
Bug Reports:
======================================
! [Critical] Cannot get profile: HTTP 401
```

---

## Test Credentials

After running tests, credentials for manual UI testing are displayed:

```
======================================
Test User Credentials
======================================
Email: test.candidate.1762990357@example.com
Password: TestPass123!
Role: candidate

Use these credentials at: http://localhost:5173/login
```

You can use these credentials to manually verify the frontend UI.

---

## Troubleshooting

### Tests Fail with "Connection refused"
- **Cause:** Services not running
- **Solution:** Start all services with `./dev-services.sh`

### Tests Fail with "No token"
- **Cause:** Registration or login failed
- **Solution:** Check auth service logs at `/tmp/jobgraph-auth.log`

### Tests Fail with "404 Not Found"
- **Cause:** Missing database records or incorrect IDs
- **Solution:** Re-run database setup: `./scripts/setup-database.sh`

### Match calculation returns 0 candidates
- **Expected:** This is normal if no seeded candidates meet the job requirements
- **Solution:** Run candidate flow first to create test candidate with skills

---

## CI/CD Integration

These scripts are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    docker-compose up -d
    ./scripts/setup-database.sh
    ./dev-services.sh &
    sleep 15
    ./backend/tests/e2e/run-all.sh
```

Exit codes:
- `0` - All tests passed
- `1` - One or more tests failed

---

## Maintenance

### Adding New Tests

1. Add test case to appropriate script
2. Follow existing pattern:
   ```bash
   test_case "X.Y.Z - Test description"
   HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" ...)

   if [ "$HTTP_CODE" = "200" ]; then
       echo "✓ Success message"
       assert_success 0 "" "Test name"
   else
       assert_success 1 "HTTP $HTTP_CODE" "Test name"
   fi
   ```

3. Update test count in README
4. Verify test passes

### Test Data Cleanup

Tests create temporary data:
- Test users: `test.candidate.{timestamp}@example.com`
- Test companies: `TestCorp {timestamp}`
- Test jobs: Created by test employers

To clean up test data periodically:
```sql
DELETE FROM users WHERE email LIKE 'test.%@example.com';
```

---

## Related Documentation

- [E2E_TEST_PLAN.md](../../../E2E_TEST_PLAN.md) - Manual testing checklist (~150 test cases)
- [E2E_TEST_RESULTS.md](../../../E2E_TEST_RESULTS.md) - Historical test results
- [PHASE_1_CHECKLIST.md](../../../PHASE_1_CHECKLIST.md) - Phase 1 progress tracker

---

## Test Coverage

**Current Coverage:** 33 automated E2E tests

| Area | Coverage |
|------|----------|
| Authentication | ✅ Complete |
| Candidate Profile CRUD | ✅ Complete |
| Skills Management | ✅ Complete |
| Job Posting & Skills | ✅ Complete |
| Job Matching Algorithm | ✅ Complete |
| Job Applications | ✅ Complete |
| Company Profile | ✅ Complete |
| Resume Upload | ⚠️ Partial (separate test script) |
| Interview System | ❌ Phase 2 |

**Last Updated:** 2025-11-12
**Status:** All tests passing ✅
