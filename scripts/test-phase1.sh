#!/bin/bash

# Phase 1 Testing Script
# This script verifies all Phase 1 components are working correctly

# Don't exit on error - we want to run all tests and report results
set +e

echo "🧪 JobGraph Phase 1 Testing"
echo "============================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((TESTS_FAILED++))
  fi
}

# Test 1: Check if Docker is running
echo "Test 1: Checking Docker daemon..."
if docker info > /dev/null 2>&1; then
  test_result 0 "Docker is running"
else
  test_result 1 "Docker is not running - please start Docker Desktop"
  echo ""
  echo "============================"
  echo "❌ Cannot continue without Docker"
  echo "============================"
  echo ""
  echo "Please start Docker Desktop and run this script again."
  exit 1
fi

echo ""

# Test 2: Check if Docker Compose services are running
echo "Test 2: Checking Docker Compose services..."
docker-compose ps
echo ""

if docker ps | grep -q jobgraph-postgres; then
  test_result 0 "PostgreSQL container is running"
else
  echo -e "${YELLOW}⚠ PostgreSQL not running - starting services...${NC}"
  docker-compose up -d
  sleep 5
fi

if docker ps | grep -q jobgraph-redis; then
  test_result 0 "Redis container is running"
else
  test_result 1 "Redis container is not running"
fi

echo ""

# Test 3: Check PostgreSQL connection
echo "Test 3: Testing PostgreSQL connection..."
if docker exec jobgraph-postgres pg_isready -U postgres > /dev/null 2>&1; then
  test_result 0 "PostgreSQL is accepting connections"
else
  test_result 1 "PostgreSQL is not ready"
fi

echo ""

# Test 4: Check Redis connection
echo "Test 4: Testing Redis connection..."
if docker exec jobgraph-redis redis-cli ping | grep -q PONG; then
  test_result 0 "Redis is responding to PING"
else
  test_result 1 "Redis is not responding"
fi

echo ""

# Test 5: Check database schema
echo "Test 5: Checking database schema..."
TABLE_COUNT=$(docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)

if [ "$TABLE_COUNT" -gt 0 ]; then
  test_result 0 "Database has $TABLE_COUNT tables"
else
  test_result 1 "Database schema not loaded (0 tables found)"
fi

echo ""

# Test 6: Check if Auth Service is running
echo "Test 6: Checking Auth Service (Port 3000)..."
AUTH_HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
if echo "$AUTH_HEALTH" | grep -q "healthy"; then
  test_result 0 "Auth Service is healthy"
  echo "   $(echo $AUTH_HEALTH | jq -r '.timestamp // "No timestamp"')"
else
  test_result 1 "Auth Service is not responding"
  echo -e "${YELLOW}   Make sure Auth Service is running: cd backend/services/auth-service && npm run dev${NC}"
fi

echo ""

# Test 7: Check if Profile Service is running
echo "Test 7: Checking Profile Service (Port 3001)..."
PROFILE_HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null)
if echo "$PROFILE_HEALTH" | grep -q "healthy"; then
  test_result 0 "Profile Service is healthy"
  echo "   $(echo $PROFILE_HEALTH | jq -r '.timestamp // "No timestamp"')"
else
  test_result 1 "Profile Service is not responding"
  echo -e "${YELLOW}   Make sure Profile Service is running: cd backend/services/profile-service && npm run dev${NC}"
fi

echo ""

# Test 8: Test Auth - User Login
echo "Test 8: Testing Auth Service - Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "candidate@test.com", "password": "Test123!"}' 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
  test_result 0 "User login successful"
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
  echo "   Token received (length: ${#TOKEN})"
else
  test_result 1 "User login failed"
  echo "   Response: $(echo $LOGIN_RESPONSE | jq -r '.error.message // "Unknown error"')"
  TOKEN=""
fi

echo ""

# Test 9: Test Auth - Protected Route
echo "Test 9: Testing Auth Service - Protected Route..."
if [ -n "$TOKEN" ]; then
  ME_RESPONSE=$(curl -s -X GET http://localhost:3000/api/v1/auth/me \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  if echo "$ME_RESPONSE" | grep -q "candidate@test.com"; then
    test_result 0 "Protected route access successful"
    echo "   User: $(echo $ME_RESPONSE | jq -r '.data.email')"
  else
    test_result 1 "Protected route access failed"
  fi
else
  test_result 1 "Cannot test protected route (no token)"
fi

echo ""

# Test 10: Test Auth - Unauthorized Access
echo "Test 10: Testing Auth Service - Unauthorized Access..."
UNAUTH_RESPONSE=$(curl -s -X GET http://localhost:3000/api/v1/auth/me 2>/dev/null)
if echo "$UNAUTH_RESPONSE" | grep -q "NO_TOKEN"; then
  test_result 0 "Unauthorized access properly blocked"
else
  test_result 1 "Unauthorized access not properly blocked"
fi

echo ""

# Test 11: Test Profile Service - Get Profile
echo "Test 11: Testing Profile Service - Get Profile..."
if [ -n "$TOKEN" ]; then
  PROFILE_RESPONSE=$(curl -s -X GET http://localhost:3001/api/v1/profiles/candidate \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  if echo "$PROFILE_RESPONSE" | grep -q "profileId"; then
    test_result 0 "Get profile successful"
    PROFILE_ID=$(echo $PROFILE_RESPONSE | jq -r '.data.profileId')
    echo "   Profile ID: $PROFILE_ID"
  else
    test_result 1 "Get profile failed"
    echo "   Response: $(echo $PROFILE_RESPONSE | jq -r '.error.message // "Unknown error"')"
  fi
else
  test_result 1 "Cannot test profile (no token)"
fi

echo ""

# Test 12: Test Profile Service - Update Profile
echo "Test 12: Testing Profile Service - Update Profile..."
if [ -n "$TOKEN" ]; then
  UPDATE_RESPONSE=$(curl -s -X PUT http://localhost:3001/api/v1/profiles/candidate \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"headline": "Test Engineer - Phase 1", "yearsExperience": 3}' 2>/dev/null)

  if echo "$UPDATE_RESPONSE" | grep -q "Test Engineer"; then
    test_result 0 "Update profile successful"
  else
    test_result 1 "Update profile failed"
  fi
else
  test_result 1 "Cannot test profile update (no token)"
fi

echo ""

# Test 13: Test Profile Service - Add Education
echo "Test 13: Testing Profile Service - Add Education..."
if [ -n "$TOKEN" ]; then
  EDU_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/profiles/candidate/education \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"degree": "Test Degree", "institution": "Test University", "graduationYear": 2020}' 2>/dev/null)

  if echo "$EDU_RESPONSE" | grep -q "educationId"; then
    test_result 0 "Add education successful"
    EDU_ID=$(echo $EDU_RESPONSE | jq -r '.data.educationId')
  else
    test_result 1 "Add education failed"
    EDU_ID=""
  fi
else
  test_result 1 "Cannot test add education (no token)"
  EDU_ID=""
fi

echo ""

# Test 14: Test Profile Service - Delete Education
echo "Test 14: Testing Profile Service - Delete Education..."
if [ -n "$TOKEN" ] && [ -n "$EDU_ID" ]; then
  DEL_EDU_RESPONSE=$(curl -s -X DELETE http://localhost:3001/api/v1/profiles/candidate/education/$EDU_ID \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  if echo "$DEL_EDU_RESPONSE" | grep -q "deleted successfully"; then
    test_result 0 "Delete education successful"
  else
    test_result 1 "Delete education failed"
  fi
else
  test_result 1 "Cannot test delete education (no token or education ID)"
fi

echo ""

# Test 15: Test Profile Service - Add Work Experience
echo "Test 15: Testing Profile Service - Add Work Experience..."
if [ -n "$TOKEN" ]; then
  EXP_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/profiles/candidate/experience \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title": "Test Engineer", "company": "Test Corp", "startDate": "2020-01-01", "isCurrent": false, "endDate": "2023-01-01"}' 2>/dev/null)

  if echo "$EXP_RESPONSE" | grep -q "experienceId"; then
    test_result 0 "Add work experience successful"
    EXP_ID=$(echo $EXP_RESPONSE | jq -r '.data.experienceId')
  else
    test_result 1 "Add work experience failed"
    EXP_ID=""
  fi
else
  test_result 1 "Cannot test add work experience (no token)"
  EXP_ID=""
fi

echo ""

# Test 16: Test Profile Service - Delete Work Experience
echo "Test 16: Testing Profile Service - Delete Work Experience..."
if [ -n "$TOKEN" ] && [ -n "$EXP_ID" ]; then
  DEL_EXP_RESPONSE=$(curl -s -X DELETE http://localhost:3001/api/v1/profiles/candidate/experience/$EXP_ID \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null)

  if echo "$DEL_EXP_RESPONSE" | grep -q "deleted successfully"; then
    test_result 0 "Delete work experience successful"
  else
    test_result 1 "Delete work experience failed"
  fi
else
  test_result 1 "Cannot test delete work experience (no token or experience ID)"
fi

echo ""

# Test 17: Check if backend dependencies are installed
echo "Test 17: Checking backend dependencies..."
if [ -d "backend/node_modules" ]; then
  test_result 0 "Backend node_modules exists"
else
  test_result 1 "Backend dependencies not installed"
  echo -e "${YELLOW}   Run: cd backend && npm install${NC}"
fi

echo ""

# Test 18: Check if common package is built
echo "Test 18: Checking common package build..."
if [ -d "backend/common/dist" ]; then
  test_result 0 "Common package is built"
else
  test_result 1 "Common package not built"
  echo -e "${YELLOW}   Run: cd backend/common && npm run build${NC}"
fi

echo ""

# Test 19: Password Validation
echo "Test 19: Testing Password Validation..."
WEAK_PW_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "weak@test.com", "password": "weak", "firstName": "Test", "lastName": "User", "role": "candidate"}' 2>/dev/null)

if echo "$WEAK_PW_RESPONSE" | grep -q "WEAK_PASSWORD"; then
  test_result 0 "Weak password properly rejected"
else
  test_result 1 "Weak password validation failed"
fi

echo ""

# Test 20: Email Validation
echo "Test 20: Testing Email Validation..."
INVALID_EMAIL_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email", "password": "Test123!", "firstName": "Test", "lastName": "User", "role": "candidate"}' 2>/dev/null)

if echo "$INVALID_EMAIL_RESPONSE" | grep -q "INVALID_EMAIL"; then
  test_result 0 "Invalid email properly rejected"
else
  test_result 1 "Email validation failed"
fi

echo ""

# Test 21: Check if Job Service is running
echo "Test 21: Checking Job Service (Port 3002)..."
JOB_HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null)
if echo "$JOB_HEALTH" | grep -q "healthy"; then
  test_result 0 "Job Service is healthy"
  echo "   $(echo $JOB_HEALTH | jq -r '.timestamp // "No timestamp"')"
else
  test_result 1 "Job Service is not responding"
  echo -e "${YELLOW}   Make sure Job Service is running: cd backend/services/job-service && npm run dev${NC}"
fi

echo ""

# Test 22: Test Job Service - Create Job
echo "Test 22: Testing Job Service - Create Job..."
# Get company ID
COMPANY_ID=$(docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT company_id FROM companies WHERE name = 'Test Company Inc' LIMIT 1" 2>/dev/null | xargs)

if [ -n "$TOKEN" ] && [ -n "$COMPANY_ID" ]; then
  # Login as employer first
  EMPLOYER_LOGIN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "employer@test.com",
      "password": "Test123!"
    }' 2>/dev/null)

  EMPLOYER_TOKEN=$(echo "$EMPLOYER_LOGIN" | jq -r '.data.token // empty')

  if [ -n "$EMPLOYER_TOKEN" ]; then
    JOB_CREATE_RESPONSE=$(curl -s -X POST http://localhost:3002/api/v1/jobs \
      -H "Authorization: Bearer $EMPLOYER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "companyId": "'"$COMPANY_ID"'",
        "title": "Test Job",
        "description": "Test job description",
        "city": "San Francisco",
        "state": "CA",
        "country": "USA",
        "remoteOption": "remote",
        "employmentType": "full-time",
        "experienceLevel": "mid"
      }' 2>/dev/null)

    if echo "$JOB_CREATE_RESPONSE" | grep -q "jobId"; then
      test_result 0 "Job creation successful"
      TEST_JOB_ID=$(echo $JOB_CREATE_RESPONSE | jq -r '.data.jobId')
    else
      test_result 1 "Job creation failed"
    fi
  else
    test_result 1 "Could not login as employer"
  fi
else
  test_result 1 "Cannot test job creation (missing data)"
fi

echo ""

# Test 23: Test Job Service - Add Skill to Job
echo "Test 23: Testing Job Service - Add Skill to Job..."
if [ -n "$EMPLOYER_TOKEN" ] && [ -n "$TEST_JOB_ID" ]; then
  # Get a skill ID
  SKILL_ID=$(docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT skill_id FROM skills WHERE name = 'Python' LIMIT 1" 2>/dev/null | xargs)

  if [ -n "$SKILL_ID" ]; then
    JOB_SKILL_RESPONSE=$(curl -s -X POST "http://localhost:3002/api/v1/jobs/${TEST_JOB_ID}/skills" \
      -H "Authorization: Bearer $EMPLOYER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "skillId": "'"$SKILL_ID"'",
        "weight": 0.8,
        "minimumScore": 70,
        "required": true
      }' 2>/dev/null)

    if echo "$JOB_SKILL_RESPONSE" | grep -q "jobSkillId"; then
      test_result 0 "Add skill to job successful"
    else
      test_result 1 "Add skill to job failed"
    fi
  else
    test_result 1 "Could not get skill ID"
  fi
else
  test_result 1 "Cannot test add skill (missing job or token)"
fi

echo ""

# Test 24: Test Job Service - Get Job
echo "Test 24: Testing Job Service - Get Job..."
if [ -n "$TEST_JOB_ID" ]; then
  JOB_GET_RESPONSE=$(curl -s -X GET "http://localhost:3002/api/v1/jobs/${TEST_JOB_ID}" 2>/dev/null)

  if echo "$JOB_GET_RESPONSE" | grep -q "Test Job"; then
    test_result 0 "Get job successful"
  else
    test_result 1 "Get job failed"
  fi
else
  test_result 1 "Cannot test get job (no job ID)"
fi

echo ""

# ============================================================================
# SKILLS SERVICE TESTS (Port 3003)
# ============================================================================

# Test 25: Check if Skills Service is running
echo "Test 25: Check if Skills Service is running..."
SKILL_HEALTH=$(curl -s http://localhost:3003/health 2>/dev/null || echo "")
if echo "$SKILL_HEALTH" | grep -q "healthy"; then
  test_result 0 "Skills Service is healthy"
else
  test_result 1 "Skills Service is not running"
fi

echo ""

# Test 26: Get skills with pagination
echo "Test 26: Get skills list..."
SKILLS_RESPONSE=$(curl -s "http://localhost:3003/api/v1/skills?limit=5" 2>/dev/null || echo "")
if echo "$SKILLS_RESPONSE" | grep -q "\"success\":true"; then
  test_result 0 "Get skills successful"
  SKILL_COUNT=$(echo "$SKILLS_RESPONSE" | grep -o "skillId" | wc -l | xargs)
  echo "  Retrieved $SKILL_COUNT skills"
else
  test_result 1 "Get skills failed"
fi

echo ""

# Test 27: Get skill categories
echo "Test 27: Get skill categories..."
CATEGORIES_RESPONSE=$(curl -s "http://localhost:3003/api/v1/skills/categories" 2>/dev/null || echo "")
if echo "$CATEGORIES_RESPONSE" | grep -q "\"success\":true"; then
  test_result 0 "Get categories successful"
else
  test_result 1 "Get categories failed"
fi

echo ""

# Test 28: Add manual skill score to candidate profile
echo "Test 28: Add skill score to candidate profile..."
# Get a skill ID - extract from the JSON response
PYTHON_SKILL_ID=$(echo "$SKILLS_RESPONSE" | sed -n 's/.*"skillId":"\([^"]*\)".*/\1/p' | head -1)

if [ -n "$PYTHON_SKILL_ID" ] && [ "$PYTHON_SKILL_ID" != "" ] && [ -n "$TOKEN" ]; then
  ADD_SKILL_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/profiles/candidate/skills \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "skillId": "'"${PYTHON_SKILL_ID}"'",
      "score": 85
    }' 2>/dev/null || echo "")

  if echo "$ADD_SKILL_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Add skill score successful"
  else
    # May fail if skill already exists from previous test run - check for that
    if echo "$ADD_SKILL_RESPONSE" | grep -q "SKILL_ALREADY_EXISTS"; then
      test_result 0 "Add skill score successful (skill already exists)"
    else
      test_result 1 "Add skill score failed"
      echo "  Response: $ADD_SKILL_RESPONSE" | head -c 200
    fi
  fi
else
  test_result 1 "Cannot test add skill (missing skill ID or token)"
  echo "  Skill ID: '$PYTHON_SKILL_ID', Token length: ${#TOKEN}"
fi

echo ""

# Test 29: Get candidate's skill scores
echo "Test 29: Get candidate's skill scores..."
if [ -n "$TOKEN" ]; then
  GET_SKILLS_RESPONSE=$(curl -s -X GET http://localhost:3001/api/v1/profiles/candidate/skills \
    -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "")

  if echo "$GET_SKILLS_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Get candidate skills successful"
    CANDIDATE_SKILL_COUNT=$(echo "$GET_SKILLS_RESPONSE" | grep -o "userSkillId" | wc -l | xargs)
    echo "  Candidate has $CANDIDATE_SKILL_COUNT skills"
  else
    test_result 1 "Get candidate skills failed"
  fi
else
  test_result 1 "Cannot test get candidate skills (no token)"
fi

echo ""

# Test 30: Update skill score
echo "Test 30: Update skill score..."
if [ -n "$PYTHON_SKILL_ID" ] && [ "$PYTHON_SKILL_ID" != "" ] && [ -n "$TOKEN" ]; then
  UPDATE_SKILL_RESPONSE=$(curl -s -X PUT "http://localhost:3001/api/v1/profiles/candidate/skills/${PYTHON_SKILL_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"score": 92}' 2>/dev/null || echo "")

  if echo "$UPDATE_SKILL_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Update skill score successful"
  else
    test_result 1 "Update skill score failed"
    echo "  Response: $UPDATE_SKILL_RESPONSE" | head -c 200
  fi
else
  test_result 1 "Cannot test update skill (missing skill ID or token)"
  echo "  Skill ID: '$PYTHON_SKILL_ID', Token length: ${#TOKEN}"
fi

echo ""

# ============================================================================
# MATCHING SERVICE TESTS (Port 3004)
# ============================================================================

# Test 31: Check if Matching Service is running
echo "Test 31: Check if Matching Service is running..."
MATCHING_HEALTH=$(curl -s http://localhost:3004/health 2>/dev/null || echo "")
if echo "$MATCHING_HEALTH" | grep -q "healthy"; then
  test_result 0 "Matching Service is healthy"
else
  test_result 1 "Matching Service is not running"
fi

echo ""

# Test 32: Calculate job matches (employer must have job with skills)
echo "Test 32: Calculate job matches..."
if [ -n "$TEST_JOB_ID" ] && [ -n "$EMPLOYER_TOKEN" ]; then
  CALC_MATCHES_RESPONSE=$(curl -s -X POST "http://localhost:3004/api/v1/matching/jobs/${TEST_JOB_ID}/calculate" \
    -H "Authorization: Bearer ${EMPLOYER_TOKEN}" 2>/dev/null || echo "")

  if echo "$CALC_MATCHES_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Calculate matches successful"
    TOTAL_MATCHES=$(echo "$CALC_MATCHES_RESPONSE" | sed -n 's/.*"totalMatches":\([0-9]*\).*/\1/p')
    echo "  Found $TOTAL_MATCHES candidate matches"
  else
    test_result 1 "Calculate matches failed"
    echo "  Response: $CALC_MATCHES_RESPONSE" | head -c 200
  fi
else
  test_result 1 "Cannot test calculate matches (missing job ID or employer token)"
  echo "  Job ID: '$TEST_JOB_ID', Employer token length: ${#EMPLOYER_TOKEN}"
fi

echo ""

# Test 33: Get job candidates (employer view)
echo "Test 33: Get job candidates (employer view)..."
if [ -n "$TEST_JOB_ID" ] && [ -n "$EMPLOYER_TOKEN" ]; then
  GET_CANDIDATES_RESPONSE=$(curl -s -X GET "http://localhost:3004/api/v1/matching/jobs/${TEST_JOB_ID}/candidates" \
    -H "Authorization: Bearer ${EMPLOYER_TOKEN}" 2>/dev/null || echo "")

  if echo "$GET_CANDIDATES_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Get job candidates successful"
    CANDIDATE_COUNT=$(echo "$GET_CANDIDATES_RESPONSE" | grep -o "matchId" | wc -l | xargs)
    echo "  Retrieved $CANDIDATE_COUNT candidate matches"
  else
    test_result 1 "Get job candidates failed"
  fi
else
  test_result 1 "Cannot test get candidates (missing job ID or employer token)"
fi

echo ""

# Test 34: Get candidate matches (candidate view)
echo "Test 34: Get candidate matches (candidate view)..."
if [ -n "$TOKEN" ]; then
  GET_MY_MATCHES_RESPONSE=$(curl -s -X GET "http://localhost:3004/api/v1/matching/candidate/matches" \
    -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "")

  if echo "$GET_MY_MATCHES_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Get candidate matches successful"
    MY_MATCH_COUNT=$(echo "$GET_MY_MATCHES_RESPONSE" | grep -o "matchId" | wc -l | xargs)
    echo "  Candidate has $MY_MATCH_COUNT job matches"
  else
    test_result 1 "Get candidate matches failed"
  fi
else
  test_result 1 "Cannot test get candidate matches (no token)"
fi

echo ""

# Test 35: Contact a candidate (employer action)
echo "Test 35: Contact a candidate..."
# Extract first match ID from the candidates response
MATCH_ID=$(echo "$GET_CANDIDATES_RESPONSE" | sed -n 's/.*"matchId":"\([^"]*\)".*/\1/p' | head -1)

if [ -n "$MATCH_ID" ] && [ "$MATCH_ID" != "" ] && [ -n "$EMPLOYER_TOKEN" ]; then
  CONTACT_RESPONSE=$(curl -s -X POST "http://localhost:3004/api/v1/matching/matches/${MATCH_ID}/contact" \
    -H "Authorization: Bearer ${EMPLOYER_TOKEN}" 2>/dev/null || echo "")

  if echo "$CONTACT_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Contact candidate successful"
  else
    test_result 1 "Contact candidate failed"
    echo "  Response: $CONTACT_RESPONSE" | head -c 200
  fi
else
  test_result 1 "Cannot test contact candidate (missing match ID or employer token)"
  echo "  Match ID: '$MATCH_ID', Employer token length: ${#EMPLOYER_TOKEN}"
fi

echo ""

# Test 36: Update match status
echo "Test 36: Update match status..."
if [ -n "$MATCH_ID" ] && [ "$MATCH_ID" != "" ] && [ -n "$EMPLOYER_TOKEN" ]; then
  UPDATE_STATUS_RESPONSE=$(curl -s -X PUT "http://localhost:3004/api/v1/matching/matches/${MATCH_ID}/status" \
    -H "Authorization: Bearer ${EMPLOYER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"status": "shortlisted"}' 2>/dev/null || echo "")

  if echo "$UPDATE_STATUS_RESPONSE" | grep -q "\"success\":true"; then
    test_result 0 "Update match status successful"
  else
    test_result 1 "Update match status failed"
    echo "  Response: $UPDATE_STATUS_RESPONSE" | head -c 200
  fi
else
  test_result 1 "Cannot test update match status (missing match ID or employer token)"
fi

echo ""

# Summary
echo "============================"
echo "📊 Test Summary"
echo "============================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 1 is fully operational!${NC}"
  echo ""
  echo "Services Running:"
  echo "  • Auth Service: http://localhost:3000"
  echo "  • Profile Service: http://localhost:3001"
  echo "  • Job Service: http://localhost:3002"
  echo "  • Skills Service: http://localhost:3003"
  echo "  • Matching Service: http://localhost:3004"
  echo ""
  echo "Database:"
  echo "  • PostgreSQL: localhost:5432"
  echo "  • Redis: localhost:6379"
  echo "  • Adminer: http://localhost:8080"
  echo ""
  echo "Next Steps:"
  echo "  1. Create Frontend (React + TypeScript)"
  echo "  2. Add E2E testing"
  echo "  3. Prepare for Phase 2 (Interview System)"
  exit 0
else
  echo -e "${YELLOW}⚠ Some tests failed. Please review the failures above.${NC}"
  echo ""
  echo "Common Issues:"
  echo "  • Services not running: Start with 'npm run dev' in service directories"
  echo "  • Database not ready: Wait a few seconds and try again"
  echo "  • Dependencies not installed: Run 'cd backend && npm install'"
  exit 1
fi
