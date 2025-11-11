#!/bin/bash

# Phase 0 Testing Script
# This script verifies all Phase 0 components are working correctly

# Don't exit on error - we want to run all tests and report results
set +e

echo "🧪 JobGraph Phase 0 Testing"
echo "============================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

if docker ps | grep -q jobgraph-adminer; then
  test_result 0 "Adminer container is running"
else
  test_result 1 "Adminer container is not running"
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

# Test 5: Check if database exists
echo "Test 5: Checking if jobgraph_dev database exists..."
if docker exec jobgraph-postgres psql -U postgres -lqt | cut -d \| -f 1 | grep -qw jobgraph_dev; then
  test_result 0 "jobgraph_dev database exists"
else
  test_result 1 "jobgraph_dev database does not exist"
fi

echo ""

# Test 6: Check if tables exist
echo "Test 6: Checking database schema..."
TABLE_COUNT=$(docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)

if [ "$TABLE_COUNT" -gt 0 ]; then
  test_result 0 "Database has $TABLE_COUNT tables"
  echo "   Tables found:"
  docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -c "\dt" | grep public | awk '{print "   - " $3}'
else
  test_result 1 "Database schema not loaded (0 tables found)"
  echo -e "${YELLOW}   Run: docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql${NC}"
fi

echo ""

# Test 7: Check and seed data if needed
echo "Test 7: Checking and seeding data..."
SKILL_COUNT=$(docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT COUNT(*) FROM skills;" 2>/dev/null | xargs || echo "0")
USER_COUNT=$(docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")

# Check skills
if [ "$SKILL_COUNT" -gt 0 ]; then
  test_result 0 "Skills table has $SKILL_COUNT records"
else
  echo -e "${YELLOW}   Skills table empty - seeding now...${NC}"
  cd backend
  if npx ts-node ../scripts/seed-data/seed-skills.ts 2>&1 | grep -q "Seeded"; then
    SKILL_COUNT=$(docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT COUNT(*) FROM skills;" 2>/dev/null | xargs || echo "0")
    test_result 0 "Skills seeded successfully ($SKILL_COUNT records)"
  else
    test_result 1 "Failed to seed skills"
  fi
  cd ..
fi

# Check users
if [ "$USER_COUNT" -gt 0 ]; then
  test_result 0 "Users table has $USER_COUNT records"
else
  echo -e "${YELLOW}   Users table empty - seeding now...${NC}"
  cd backend
  if npx ts-node ../scripts/seed-data/seed-test-users.ts 2>&1 | grep -q "Seeded"; then
    USER_COUNT=$(docker exec jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs || echo "0")
    test_result 0 "Test users seeded successfully ($USER_COUNT records)"
    echo ""
    echo -e "${GREEN}   Test credentials created:${NC}"
    echo "   - Candidate: candidate@test.com / Test123!"
    echo "   - Employer: employer@test.com / Test123!"
    echo "   - Admin: admin@test.com / Admin123!"
  else
    test_result 1 "Failed to seed test users"
  fi
  cd ..
fi

echo ""

# Test 8: Check if backend dependencies are installed
echo "Test 8: Checking backend dependencies..."
if [ -d "backend/node_modules" ]; then
  test_result 0 "Backend node_modules exists"
else
  test_result 1 "Backend dependencies not installed"
  echo -e "${YELLOW}   Run: cd backend && npm install${NC}"
fi

echo ""

# Test 9: Check if common package is built
echo "Test 9: Checking common package build..."
if [ -d "backend/common/dist" ]; then
  test_result 0 "Common package is built (dist/ exists)"

  # Check for key files
  if [ -f "backend/common/dist/index.js" ]; then
    test_result 0 "index.js exists in dist/"
  else
    test_result 1 "index.js missing from dist/"
  fi

  if [ -f "backend/common/dist/database/index.js" ]; then
    test_result 0 "database module compiled"
  else
    test_result 1 "database module not compiled"
  fi
else
  test_result 1 "Common package not built"
  echo -e "${YELLOW}   Run: cd backend/common && npm run build${NC}"
fi

echo ""

# Test 10: Run Jest tests
echo "Test 10: Running Jest unit tests..."
cd backend
if npm test 2>&1 | tee /tmp/jest-output.txt | grep -q "PASS"; then
  test_result 0 "Jest tests passed"
  echo "   Test summary:"
  grep "Tests:" /tmp/jest-output.txt | head -1 | sed 's/^/   /'
else
  test_result 1 "Jest tests failed"
  echo -e "${YELLOW}   Check output above for details${NC}"
fi
cd ..

echo ""

# Test 11: Check if Adminer is accessible
echo "Test 11: Checking Adminer web interface..."
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  test_result 0 "Adminer is accessible at http://localhost:8080"
else
  test_result 1 "Adminer is not accessible"
fi

echo ""
echo "============================"
echo "📊 Test Summary"
echo "============================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 0 is fully operational!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Access Adminer: http://localhost:8080"
  echo "     - Server: postgres"
  echo "     - Username: postgres"
  echo "     - Password: postgres"
  echo "     - Database: jobgraph_dev"
  echo ""
  echo "  2. View test credentials:"
  echo "     - Candidate: candidate@test.com / Test123!"
  echo "     - Employer: employer@test.com / Test123!"
  echo "     - Admin: admin@test.com / Admin123!"
  echo ""
  echo "  3. Ready for Phase 1 implementation!"
  exit 0
else
  echo -e "${YELLOW}⚠ Some tests failed. Please review the failures above.${NC}"
  exit 1
fi
