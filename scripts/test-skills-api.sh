#!/bin/bash

# Test script for Skills Management API
# Tests both Skills Service (port 3003) and Profile Service skill score management (port 3001)

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API URLs
AUTH_URL="http://localhost:3000/api/v1/auth"
PROFILE_URL="http://localhost:3001/api/v1/profiles"
SKILL_URL="http://localhost:3003/api/v1/skills"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $2"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗${NC} $2"
    ((TESTS_FAILED++))
  fi
}

echo "================================================"
echo "Skills Management API Tests"
echo "================================================"
echo ""

# Test 1: Check Skills Service health
echo "Test 1: Check Skills Service health"
SKILL_HEALTH=$(curl -s http://localhost:3003/health 2>/dev/null || echo "")
if echo "$SKILL_HEALTH" | grep -q "healthy"; then
  test_result 0 "Skills Service is healthy"
else
  test_result 1 "Skills Service is not healthy"
  echo "Response: $SKILL_HEALTH"
fi
echo ""

# Test 2: Get all skills with pagination
echo "Test 2: Get all skills (paginated)"
SKILLS_RESPONSE=$(curl -s "${SKILL_URL}?limit=5" 2>/dev/null || echo "")
if echo "$SKILLS_RESPONSE" | jq -e '.success == true and (.data | length) > 0' > /dev/null 2>&1; then
  test_result 0 "Can fetch skills with pagination"
  SKILL_COUNT=$(echo "$SKILLS_RESPONSE" | jq '.data | length')
  echo "  Retrieved $SKILL_COUNT skills"
else
  test_result 1 "Failed to fetch skills"
  echo "Response: $SKILLS_RESPONSE"
fi
echo ""

# Test 3: Get skill categories
echo "Test 3: Get skill categories"
CATEGORIES_RESPONSE=$(curl -s "${SKILL_URL}/categories" 2>/dev/null || echo "")
if echo "$CATEGORIES_RESPONSE" | jq -e '.success == true and (.data | length) > 0' > /dev/null 2>&1; then
  test_result 0 "Can fetch skill categories"
  CATEGORIES=$(echo "$CATEGORIES_RESPONSE" | jq -r '.data[]' | tr '\n' ', ' | sed 's/,$//')
  echo "  Categories: $CATEGORIES"
else
  test_result 1 "Failed to fetch categories"
fi
echo ""

# Test 4: Get specific skill by ID (use Python skill)
echo "Test 4: Get specific skill by ID"
PYTHON_SKILL_ID=$(echo "$SKILLS_RESPONSE" | jq -r '.data[0].skillId')
SKILL_DETAIL=$(curl -s "${SKILL_URL}/${PYTHON_SKILL_ID}" 2>/dev/null || echo "")
if echo "$SKILL_DETAIL" | jq -e '.success == true and .data.skillId' > /dev/null 2>&1; then
  test_result 0 "Can fetch skill details by ID"
  SKILL_NAME=$(echo "$SKILL_DETAIL" | jq -r '.data.name')
  echo "  Skill: $SKILL_NAME"
else
  test_result 1 "Failed to fetch skill details"
fi
echo ""

# Test 5: Filter skills by category
echo "Test 5: Filter skills by category (programming)"
FILTERED_SKILLS=$(curl -s "${SKILL_URL}?category=programming" 2>/dev/null || echo "")
if echo "$FILTERED_SKILLS" | jq -e '.success == true' > /dev/null 2>&1; then
  test_result 0 "Can filter skills by category"
else
  test_result 1 "Failed to filter skills"
fi
echo ""

# Test 6: Search skills by name
echo "Test 6: Search skills by name (Python)"
SEARCH_SKILLS=$(curl -s "${SKILL_URL}?search=Python" 2>/dev/null || echo "")
if echo "$SEARCH_SKILLS" | jq -e '.success == true' > /dev/null 2>&1; then
  test_result 0 "Can search skills by name"
else
  test_result 1 "Failed to search skills"
fi
echo ""

# Login as candidate for authenticated tests
echo "Test 7: Login as candidate"
CANDIDATE_LOGIN=$(curl -s -X POST ${AUTH_URL}/login \
  -H "Content-Type: application/json" \
  -d '{"email":"candidate@test.com","password":"Test1234!"}' 2>/dev/null || echo "")

if echo "$CANDIDATE_LOGIN" | jq -e '.success == true and .data.token' > /dev/null 2>&1; then
  test_result 0 "Candidate login successful"
  CANDIDATE_TOKEN=$(echo "$CANDIDATE_LOGIN" | jq -r '.data.token')
else
  test_result 1 "Candidate login failed"
  echo "Response: $CANDIDATE_LOGIN"
  echo "Cannot continue with authenticated tests"
  exit 1
fi
echo ""

# Test 8: Get candidate's skills (should be empty initially)
echo "Test 8: Get candidate's skill scores"
CANDIDATE_SKILLS=$(curl -s -X GET "${PROFILE_URL}/candidate/skills" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" 2>/dev/null || echo "")
if echo "$CANDIDATE_SKILLS" | jq -e '.success == true' > /dev/null 2>&1; then
  test_result 0 "Can fetch candidate's skills"
  SKILL_COUNT=$(echo "$CANDIDATE_SKILLS" | jq '.data | length')
  echo "  Current skills: $SKILL_COUNT"
else
  test_result 1 "Failed to fetch candidate's skills"
  echo "Response: $CANDIDATE_SKILLS"
fi
echo ""

# Test 9: Add a skill score for candidate
echo "Test 9: Add skill score (Python: 85)"
ADD_SKILL=$(curl -s -X POST "${PROFILE_URL}/candidate/skills" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"skillId\":\"${PYTHON_SKILL_ID}\",\"score\":85}" 2>/dev/null || echo "")
if echo "$ADD_SKILL" | jq -e '.success == true and .data.score == 85' > /dev/null 2>&1; then
  test_result 0 "Can add skill score"
  SKILL_NAME=$(echo "$ADD_SKILL" | jq -r '.data.skillName')
  echo "  Added: $SKILL_NAME with score 85"
else
  test_result 1 "Failed to add skill score"
  echo "Response: $ADD_SKILL"
fi
echo ""

# Test 10: Verify skill appears in candidate's skill list
echo "Test 10: Verify skill appears in candidate's list"
CANDIDATE_SKILLS=$(curl -s -X GET "${PROFILE_URL}/candidate/skills" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" 2>/dev/null || echo "")
if echo "$CANDIDATE_SKILLS" | jq -e '.data | length > 0' > /dev/null 2>&1; then
  test_result 0 "Skill appears in candidate's list"
  SKILLS_LIST=$(echo "$CANDIDATE_SKILLS" | jq -r '.data[] | "\(.skillName): \(.score)"' | tr '\n' ', ' | sed 's/,$//')
  echo "  Skills: $SKILLS_LIST"
else
  test_result 1 "Skill not found in candidate's list"
fi
echo ""

# Test 11: Try to add duplicate skill (should fail)
echo "Test 11: Try to add duplicate skill (should fail)"
DUPLICATE_SKILL=$(curl -s -X POST "${PROFILE_URL}/candidate/skills" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"skillId\":\"${PYTHON_SKILL_ID}\",\"score\":90}" 2>/dev/null || echo "")
if echo "$DUPLICATE_SKILL" | jq -e '.success == false and .error.code == "SKILL_ALREADY_EXISTS"' > /dev/null 2>&1; then
  test_result 0 "Duplicate skill correctly rejected"
else
  test_result 1 "Duplicate skill not properly handled"
  echo "Response: $DUPLICATE_SKILL"
fi
echo ""

# Test 12: Update skill score
echo "Test 12: Update skill score (Python: 85 → 92)"
UPDATE_SKILL=$(curl -s -X PUT "${PROFILE_URL}/candidate/skills/${PYTHON_SKILL_ID}" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"score":92}' 2>/dev/null || echo "")
if echo "$UPDATE_SKILL" | jq -e '.success == true and .data.score == 92' > /dev/null 2>&1; then
  test_result 0 "Can update skill score"
  echo "  Updated score to 92"
else
  test_result 1 "Failed to update skill score"
  echo "Response: $UPDATE_SKILL"
fi
echo ""

# Test 13: Validate score range (should reject score > 100)
echo "Test 13: Validate score range (reject score > 100)"
INVALID_SCORE=$(curl -s -X PUT "${PROFILE_URL}/candidate/skills/${PYTHON_SKILL_ID}" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"score":150}' 2>/dev/null || echo "")
if echo "$INVALID_SCORE" | jq -e '.success == false and .error.code == "INVALID_SCORE"' > /dev/null 2>&1; then
  test_result 0 "Invalid score correctly rejected"
else
  test_result 1 "Invalid score not properly handled"
  echo "Response: $INVALID_SCORE"
fi
echo ""

# Test 14: Validate score range (should reject negative score)
echo "Test 14: Validate score range (reject negative score)"
NEGATIVE_SCORE=$(curl -s -X PUT "${PROFILE_URL}/candidate/skills/${PYTHON_SKILL_ID}" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"score":-10}' 2>/dev/null || echo "")
if echo "$NEGATIVE_SCORE" | jq -e '.success == false and .error.code == "INVALID_SCORE"' > /dev/null 2>&1; then
  test_result 0 "Negative score correctly rejected"
else
  test_result 1 "Negative score not properly handled"
fi
echo ""

# Test 15: Add second skill (JavaScript)
echo "Test 15: Add second skill (JavaScript: 78)"
JS_SKILL_ID=$(curl -s "${SKILL_URL}?search=JavaScript" 2>/dev/null | jq -r '.data[0].skillId')
if [ -n "$JS_SKILL_ID" ] && [ "$JS_SKILL_ID" != "null" ]; then
  ADD_JS=$(curl -s -X POST "${PROFILE_URL}/candidate/skills" \
    -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"skillId\":\"${JS_SKILL_ID}\",\"score\":78}" 2>/dev/null || echo "")
  if echo "$ADD_JS" | jq -e '.success == true' > /dev/null 2>&1; then
    test_result 0 "Can add multiple skills"
  else
    test_result 1 "Failed to add second skill"
    echo "Response: $ADD_JS"
  fi
else
  test_result 1 "JavaScript skill not found"
fi
echo ""

# Test 16: Delete skill
echo "Test 16: Delete skill (JavaScript)"
if [ -n "$JS_SKILL_ID" ] && [ "$JS_SKILL_ID" != "null" ]; then
  DELETE_SKILL=$(curl -s -X DELETE "${PROFILE_URL}/candidate/skills/${JS_SKILL_ID}" \
    -H "Authorization: Bearer ${CANDIDATE_TOKEN}" 2>/dev/null || echo "")
  if echo "$DELETE_SKILL" | jq -e '.success == true' > /dev/null 2>&1; then
    test_result 0 "Can delete skill"
  else
    test_result 1 "Failed to delete skill"
    echo "Response: $DELETE_SKILL"
  fi
else
  test_result 1 "No JavaScript skill to delete"
fi
echo ""

# Test 17: Verify skill was deleted
echo "Test 17: Verify skill was deleted"
AFTER_DELETE=$(curl -s -X GET "${PROFILE_URL}/candidate/skills" \
  -H "Authorization: Bearer ${CANDIDATE_TOKEN}" 2>/dev/null || echo "")
REMAINING_SKILLS=$(echo "$AFTER_DELETE" | jq '.data | length')
if [ "$REMAINING_SKILLS" -eq 1 ]; then
  test_result 0 "Skill successfully deleted (1 skill remaining)"
else
  test_result 1 "Skill deletion verification failed (expected 1 skill, got $REMAINING_SKILLS)"
fi
echo ""

# Summary
echo "================================================"
echo "Test Summary"
echo "================================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
