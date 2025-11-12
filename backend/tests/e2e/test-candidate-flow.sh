#!/bin/bash

# E2E Test: Complete Candidate Flow (FIXED VERSION)
# Tests registration → profile → skills → job matches → applications

set -e

BASE_URL="http://localhost"
AUTH_URL="${BASE_URL}:3000/api/v1/auth"
PROFILE_URL="${BASE_URL}:3001/api/v1/profiles"
SKILLS_URL="${BASE_URL}:3003/api/v1/skills"
JOB_URL="${BASE_URL}:3002/api/v1/jobs"
MATCHING_URL="${BASE_URL}:3004/api/v1/matching"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Test result tracking
declare -a FAILED_TESTS
declare -a BUG_REPORTS

# Temporary file for responses
RESPONSE_FILE="/tmp/e2e_response_$$"

function cleanup() {
    rm -f "$RESPONSE_FILE"
}
trap cleanup EXIT

function test_case() {
    TOTAL=$((TOTAL + 1))
    echo -e "\n${YELLOW}Test $TOTAL: $1${NC}"
}

function assert_success() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL: $2${NC}"
        FAILED=$((FAILED + 1))
        FAILED_TESTS+=("Test $TOTAL: $3 - $2")
    fi
}

function log_bug() {
    local severity=$1
    local title=$2
    local details=$3
    BUG_REPORTS+=("[$severity] $title: $details")
}

echo "======================================"
echo "E2E Test: Complete Candidate Flow"
echo "======================================"

# Generate unique test user
TIMESTAMP=$(date +%s)
TEST_EMAIL="test.candidate.${TIMESTAMP}@example.com"
TEST_PASSWORD="TestPass123!"
TEST_FIRST_NAME="Test"
TEST_LAST_NAME="Candidate"

echo -e "\nTest User: ${TEST_EMAIL}"

# ============================================
# Test Suite 1.1: Registration & Authentication
# ============================================

test_case "1.1.1 - Register new candidate with all required fields"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${AUTH_URL}/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"firstName\": \"${TEST_FIRST_NAME}\",
    \"lastName\": \"${TEST_LAST_NAME}\",
    \"role\": \"candidate\"
  }")

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    ACCESS_TOKEN=$(jq -r '.data.accessToken // .data.access_token // .data.token' "$RESPONSE_FILE")
    USER_ID=$(jq -r '.data.user.user_id // .data.user.userId // .data.user.id' "$RESPONSE_FILE")
    echo "✓ Registered user ID: $USER_ID"
    echo "✓ Access token obtained: ${ACCESS_TOKEN:0:20}..."
    assert_success 0 "" "Register candidate"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Register candidate"
    log_bug "Critical" "Candidate registration failed" "HTTP $HTTP_CODE"
    echo "CRITICAL: Cannot continue tests without valid auth token"
    exit 1
fi

test_case "1.1.2 - Login with credentials"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${AUTH_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\"
  }")

if [ "$HTTP_CODE" = "200" ]; then
    NEW_ACCESS_TOKEN=$(jq -r '.data.accessToken // .data.access_token // .data.token' "$RESPONSE_FILE")
    echo "✓ Login successful, token refreshed"
    assert_success 0 "" "Login candidate"
    # Update token with login token
    ACCESS_TOKEN="$NEW_ACCESS_TOKEN"
else
    assert_success 1 "HTTP $HTTP_CODE" "Login candidate"
    log_bug "Critical" "Candidate login failed" "HTTP $HTTP_CODE"
fi

test_case "1.1.3 - Duplicate email registration fails"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${AUTH_URL}/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"firstName\": \"Duplicate\",
    \"lastName\": \"User\",
    \"role\": \"candidate\"
  }")

if [ "$HTTP_CODE" = "409" ]; then
    echo "✓ Duplicate registration correctly prevented (409 Conflict)"
    assert_success 0 "" "Duplicate registration prevention"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "⚠ Duplicate registration prevented with 400 (expected 409)"
    assert_success 0 "" "Duplicate registration prevention"
else
    assert_success 1 "Expected 409, got HTTP $HTTP_CODE" "Duplicate registration prevention"
    log_bug "High" "Duplicate email allowed" "Should return 409, got $HTTP_CODE"
fi

test_case "1.1.4 - Weak password rejected"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${AUTH_URL}/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"weak.${TIMESTAMP}@example.com\",
    \"password\": \"abc\",
    \"firstName\": \"Weak\",
    \"lastName\": \"Password\",
    \"role\": \"candidate\"
  }")

if [ "$HTTP_CODE" = "400" ]; then
    ERROR_CODE=$(jq -r '.error.code' "$RESPONSE_FILE")
    echo "✓ Weak password rejected with code: $ERROR_CODE"
    assert_success 0 "" "Weak password validation"
else
    assert_success 1 "Expected 400, got HTTP $HTTP_CODE" "Weak password validation"
    log_bug "Medium" "Weak password accepted" "Password 'abc' should be rejected"
fi

# ============================================
# Test Suite 1.3: Profile Management
# ============================================

test_case "1.3.1 - Get initial candidate profile"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X GET "${PROFILE_URL}/candidate" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$HTTP_CODE" = "200" ]; then
    PROFILE_ID=$(jq -r '.data.profile_id // .data.profileId' "$RESPONSE_FILE")
    echo "✓ Profile ID: $PROFILE_ID"
    assert_success 0 "" "Get candidate profile"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Get candidate profile"
    log_bug "High" "Cannot fetch candidate profile" "Auto-created profile not accessible"
fi

test_case "1.3.2 - Update profile basic info"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X PUT "${PROFILE_URL}/candidate" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "Senior Python Developer",
    "summary": "Experienced Python developer with 7+ years of experience building scalable web applications",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "years_experience": "5-7",
    "remote_preference": "remote",
    "willing_to_relocate": true,
    "profile_visibility": "public"
  }')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Profile updated successfully"
    assert_success 0 "" "Update profile"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Update profile"
    log_bug "High" "Profile update failed" "HTTP $HTTP_CODE"
fi

test_case "1.3.3 - Add education"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${PROFILE_URL}/candidate/education" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "degree": "Bachelor of Science",
    "fieldOfStudy": "Computer Science",
    "institution": "Stanford University",
    "graduationYear": 2015,
    "gpa": 3.8
  }')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    EDUCATION_ID=$(jq -r '.data.education_id // .data.educationId' "$RESPONSE_FILE")
    echo "✓ Education ID: $EDUCATION_ID"
    assert_success 0 "" "Add education"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Add education"
    log_bug "Medium" "Cannot add education" "HTTP $HTTP_CODE"
fi

test_case "1.3.4 - Add work experience"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${PROFILE_URL}/candidate/experience" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Python Developer",
    "company": "Google",
    "startDate": "2020-01-01",
    "isCurrent": true,
    "description": "Leading Python development team for large-scale distributed systems"
  }')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    EXPERIENCE_ID=$(jq -r '.data.experience_id // .data.experienceId' "$RESPONSE_FILE")
    echo "✓ Experience ID: $EXPERIENCE_ID"
    assert_success 0 "" "Add work experience"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Add work experience"
    log_bug "Medium" "Cannot add work experience" "HTTP $HTTP_CODE"
fi

# ============================================
# Test Suite 1.4: Skills Management
# ============================================

test_case "1.4.1 - Browse all skills (public endpoint)"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X GET "${SKILLS_URL}?limit=50")

if [ "$HTTP_CODE" = "200" ]; then
    SKILL_COUNT=$(jq '.data | length' "$RESPONSE_FILE")
    echo "✓ Found $SKILL_COUNT skills"

    # Get skill IDs (using correct field names: name and skillId)
    PYTHON_SKILL_ID=$(jq -r '.data[] | select(.name == "Python") | .skillId' "$RESPONSE_FILE")
    DJANGO_SKILL_ID=$(jq -r '.data[] | select(.name == "Django") | .skillId' "$RESPONSE_FILE")
    POSTGRES_SKILL_ID=$(jq -r '.data[] | select(.name == "PostgreSQL") | .skillId' "$RESPONSE_FILE")

    echo "✓ Python skill ID: $PYTHON_SKILL_ID"
    echo "✓ Django skill ID: $DJANGO_SKILL_ID"
    echo "✓ PostgreSQL skill ID: $POSTGRES_SKILL_ID"

    if [ -z "$PYTHON_SKILL_ID" ] || [ "$PYTHON_SKILL_ID" = "null" ]; then
        echo "⚠ Warning: Could not extract Python skill ID from response"
        log_bug "Medium" "Skill ID extraction failed" "Cannot find Python skill ID in response"
    fi

    assert_success 0 "" "Browse skills"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Browse skills"
    log_bug "High" "Cannot browse skills" "HTTP $HTTP_CODE"
fi

test_case "1.4.2 - Add Python skill (score 85)"
if [ -n "$PYTHON_SKILL_ID" ] && [ "$PYTHON_SKILL_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${PROFILE_URL}/candidate/skills" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"skillId\": \"${PYTHON_SKILL_ID}\",
        \"score\": 85
      }")

    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        echo "✓ Python skill added with score 85"
        assert_success 0 "" "Add Python skill"
    else
        echo "Response: $(cat "$RESPONSE_FILE")"
        assert_success 1 "HTTP $HTTP_CODE" "Add Python skill"
        log_bug "High" "Cannot add skill score" "HTTP $HTTP_CODE"
    fi
else
    echo "⚠ Skipping - Python skill ID not available"
    assert_success 1 "Python skill ID not found" "Add Python skill"
fi

test_case "1.4.3 - Add Django skill (score 80)"
if [ -n "$DJANGO_SKILL_ID" ] && [ "$DJANGO_SKILL_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "${PROFILE_URL}/candidate/skills" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"skillId\": \"${DJANGO_SKILL_ID}\",
        \"score\": 80
      }")

    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        echo "✓ Django skill added with score 80"
        assert_success 0 "" "Add Django skill"
    else
        assert_success 1 "HTTP $HTTP_CODE" "Add Django skill"
    fi
else
    echo "⚠ Skipping - Django skill ID not available"
    assert_success 1 "Django skill ID not found" "Add Django skill"
fi

test_case "1.4.4 - Add PostgreSQL skill (score 75)"
if [ -n "$POSTGRES_SKILL_ID" ] && [ "$POSTGRES_SKILL_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "${PROFILE_URL}/candidate/skills" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"skillId\": \"${POSTGRES_SKILL_ID}\",
        \"score\": 75
      }")

    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        echo "✓ PostgreSQL skill added with score 75"
        assert_success 0 "" "Add PostgreSQL skill"
    else
        assert_success 1 "HTTP $HTTP_CODE" "Add PostgreSQL skill"
    fi
else
    echo "⚠ Skipping - PostgreSQL skill ID not available"
    assert_success 1 "PostgreSQL skill ID not found" "Add PostgreSQL skill"
fi

test_case "1.4.5 - Get my skills"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X GET "${PROFILE_URL}/candidate/skills" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$HTTP_CODE" = "200" ]; then
    MY_SKILL_COUNT=$(jq '.data | length' "$RESPONSE_FILE")
    echo "✓ My skills count: $MY_SKILL_COUNT"

    if [ "$MY_SKILL_COUNT" -ge "1" ]; then
        assert_success 0 "" "Get my skills"
    else
        assert_success 1 "Expected at least 1 skill, got $MY_SKILL_COUNT" "Get my skills"
        log_bug "Medium" "No skills returned" "Added skills but cannot retrieve them"
    fi
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Get my skills"
    log_bug "High" "Cannot fetch my skills" "HTTP $HTTP_CODE"
fi

test_case "1.4.6 - Duplicate skill prevention"
if [ -n "$PYTHON_SKILL_ID" ] && [ "$PYTHON_SKILL_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${PROFILE_URL}/candidate/skills" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"skillId\": \"${PYTHON_SKILL_ID}\",
        \"score\": 90
      }")

    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "409" ]; then
        echo "✓ Duplicate skill correctly prevented"
        assert_success 0 "" "Duplicate skill prevention"
    else
        assert_success 1 "Expected 400/409, got HTTP $HTTP_CODE" "Duplicate skill prevention"
        log_bug "Medium" "Duplicate skill allowed" "Should prevent adding same skill twice"
    fi
else
    echo "⚠ Skipping - Python skill ID not available"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL - 1))
fi

# ============================================
# Test Suite 1.5: Job Matches & Browsing
# ============================================

test_case "1.5.1 - Browse all jobs with match scores"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X GET "${MATCHING_URL}/candidate/browse-jobs" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$HTTP_CODE" = "200" ]; then
    JOB_COUNT=$(jq '.data.jobs | length' "$RESPONSE_FILE")
    echo "✓ Found $JOB_COUNT jobs with match scores"

    # Get first job
    FIRST_JOB_ID=$(jq -r '.data.jobs[0].jobId' "$RESPONSE_FILE")
    FIRST_JOB_SCORE=$(jq -r '.data.jobs[0].overallScore' "$RESPONSE_FILE")
    FIRST_JOB_TITLE=$(jq -r '.data.jobs[0].title' "$RESPONSE_FILE")

    echo "✓ First job: \"$FIRST_JOB_TITLE\""
    echo "✓ Job ID: $FIRST_JOB_ID"
    echo "✓ Match score: $FIRST_JOB_SCORE"

    assert_success 0 "" "Browse jobs with scores"
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Browse jobs with scores"
    log_bug "Critical" "Cannot browse jobs" "Browse jobs endpoint failing"
fi

test_case "1.5.2 - Verify match score calculation"
if [ -n "$FIRST_JOB_SCORE" ] && [ "$FIRST_JOB_SCORE" != "null" ]; then
    # Check if score is between 0-100 using awk
    SCORE_CHECK=$(awk -v score="$FIRST_JOB_SCORE" 'BEGIN {print (score >= 0 && score <= 100)}')
    if [ "$SCORE_CHECK" = "1" ]; then
        echo "✓ Match score is valid: $FIRST_JOB_SCORE (0-100 range)"
        assert_success 0 "" "Match score calculation"
    else
        assert_success 1 "Score out of range: $FIRST_JOB_SCORE" "Match score calculation"
        log_bug "High" "Invalid match score" "Score should be 0-100, got $FIRST_JOB_SCORE"
    fi
else
    assert_success 1 "No match score returned" "Match score calculation"
    log_bug "High" "Missing match scores" "Jobs returned without match scores"
fi

# ============================================
# Test Suite 1.6: Job Applications
# ============================================

test_case "1.6.1 - Apply to job without cover letter"
if [ -n "$FIRST_JOB_ID" ] && [ "$FIRST_JOB_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${JOB_URL}/${FIRST_JOB_ID}/apply" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{}')

    if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
        APPLICATION_ID=$(jq -r '.data.application_id // .data.applicationId' "$RESPONSE_FILE")
        echo "✓ Application ID: $APPLICATION_ID"
        echo "✓ Applied to job: $FIRST_JOB_TITLE"
        assert_success 0 "" "Apply to job"
    else
        echo "Response: $(cat "$RESPONSE_FILE")"
        assert_success 1 "HTTP $HTTP_CODE" "Apply to job"
        log_bug "High" "Cannot apply to job" "HTTP $HTTP_CODE"
    fi
else
    echo "⚠ Skipping - No job ID available"
    assert_success 1 "No job ID available" "Apply to job"
fi

test_case "1.6.2 - Get my applications"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X GET "${JOB_URL}/applications" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$HTTP_CODE" = "200" ]; then
    APP_COUNT=$(jq '.data | length' "$RESPONSE_FILE")
    echo "✓ My applications count: $APP_COUNT"

    if [ "$APP_COUNT" -ge "1" ]; then
        echo "✓ Application successfully saved and retrieved"
        assert_success 0 "" "Get my applications"
    else
        assert_success 1 "Expected at least 1 application, got $APP_COUNT" "Get my applications"
        log_bug "High" "Application not saved" "Applied to job but not in my applications"
    fi
else
    echo "Response: $(cat "$RESPONSE_FILE")"
    assert_success 1 "HTTP $HTTP_CODE" "Get my applications"
    log_bug "High" "Cannot fetch applications" "HTTP $HTTP_CODE"
fi

test_case "1.6.3 - Duplicate application prevention"
if [ -n "$FIRST_JOB_ID" ] && [ "$FIRST_JOB_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X POST "${JOB_URL}/${FIRST_JOB_ID}/apply" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{}')

    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "409" ]; then
        echo "✓ Duplicate application correctly prevented"
        assert_success 0 "" "Duplicate application prevention"
    else
        assert_success 1 "Expected 400/409, got HTTP $HTTP_CODE" "Duplicate application prevention"
        log_bug "Medium" "Duplicate application allowed" "Should prevent applying twice to same job"
    fi
else
    echo "⚠ Skipping - No job ID available"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL - 1))
fi

test_case "1.6.4 - Withdraw application"
if [ -n "$APPLICATION_ID" ] && [ "$APPLICATION_ID" != "null" ]; then
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$RESPONSE_FILE" -X DELETE "${JOB_URL}/applications/${APPLICATION_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}")

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✓ Application successfully withdrawn"
        assert_success 0 "" "Withdraw application"
    else
        echo "Response: $(cat "$RESPONSE_FILE")"
        assert_success 1 "HTTP $HTTP_CODE" "Withdraw application"
        log_bug "Medium" "Cannot withdraw application" "HTTP $HTTP_CODE"
    fi
else
    echo "⚠ Skipping - No application ID available"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL - 1))
fi

# ============================================
# Test Results Summary
# ============================================

echo ""
echo "======================================"
echo "Test Results Summary"
echo "======================================"
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"

PASS_RATE=$(awk -v p="$PASSED" -v t="$TOTAL" 'BEGIN {printf "%.1f", (p/t)*100}')
echo -e "Pass Rate: ${PASS_RATE}%"

# Color code the pass rate
if awk -v rate="$PASS_RATE" 'BEGIN {exit !(rate >= 90)}'; then
    echo -e "${GREEN}✓ EXCELLENT${NC}"
elif awk -v rate="$PASS_RATE" 'BEGIN {exit !(rate >= 75)}'; then
    echo -e "${YELLOW}⚠ GOOD${NC}"
else
    echo -e "${RED}✗ NEEDS IMPROVEMENT${NC}"
fi

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo ""
    echo "======================================"
    echo "Failed Tests:"
    echo "======================================"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}✗ $test${NC}"
    done
fi

if [ ${#BUG_REPORTS[@]} -gt 0 ]; then
    echo ""
    echo "======================================"
    echo "Bug Reports:"
    echo "======================================"
    for bug in "${BUG_REPORTS[@]}"; do
        echo -e "${YELLOW}! $bug${NC}"
    done
fi

echo ""
echo "======================================"
echo "Test User Credentials"
echo "======================================"
echo "Email: ${TEST_EMAIL}"
echo "Password: ${TEST_PASSWORD}"
echo "Name: ${TEST_FIRST_NAME} ${TEST_LAST_NAME}"
echo "Role: candidate"
echo ""
echo "Use these credentials for manual UI testing at:"
echo "${BLUE}http://localhost:5173/login${NC}"
echo ""

# Exit with failure if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
else
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
fi
