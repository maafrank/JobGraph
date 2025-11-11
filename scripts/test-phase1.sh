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
  echo ""
  echo "Database:"
  echo "  • PostgreSQL: localhost:5432"
  echo "  • Redis: localhost:6379"
  echo "  • Adminer: http://localhost:8080"
  echo ""
  echo "Next Steps:"
  echo "  1. Continue with Job Service"
  echo "  2. Implement Skills Management"
  echo "  3. Build Matching Service"
  echo "  4. Create Frontend"
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
