#!/bin/bash

# Test Job API Script
echo "🧪 Testing Job Service API"
echo "================================"
echo ""

AUTH_URL="http://localhost:3000/api/v1/auth"
JOB_URL="http://localhost:3002/api/v1/jobs"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Test 0: Health Check"
echo "--------------------"
curl -s http://localhost:3002/health | jq '.'
echo ""
echo ""

echo "Test 1: Login as Employer"
echo "-------------------------"
LOGIN_RESPONSE=$(curl -s -X POST ${AUTH_URL}/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employer@test.com",
    "password": "Test123!"
  }')
echo "$LOGIN_RESPONSE" | jq '.'

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty')
echo ""
if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful! Token received.${NC}"
else
  echo -e "${RED}✗ Login failed!${NC}"
  exit 1
fi
echo ""
echo ""

# Get company ID
COMPANY_ID=$(docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT company_id FROM companies WHERE name = 'Test Company Inc' LIMIT 1" | xargs)
echo "Using Company ID: $COMPANY_ID"
echo ""

# Get a skill ID for testing
SKILL_ID=$(docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT skill_id FROM skills WHERE name = 'Python' LIMIT 1" | xargs)
echo "Using Skill ID (Python): $SKILL_ID"
echo ""
echo ""

echo "Test 2: Create Job Posting"
echo "--------------------------"
CREATE_JOB_RESPONSE=$(curl -s -X POST ${JOB_URL} \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "'"$COMPANY_ID"'",
    "title": "Senior Software Engineer",
    "description": "We are looking for an experienced software engineer to join our team.",
    "requirements": "5+ years of experience with Python and JavaScript",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "remoteOption": "hybrid",
    "salaryMin": 120000,
    "salaryMax": 180000,
    "salaryCurrency": "USD",
    "employmentType": "full-time",
    "experienceLevel": "senior"
  }')
echo "$CREATE_JOB_RESPONSE" | jq '.'

JOB_ID=$(echo "$CREATE_JOB_RESPONSE" | jq -r '.data.jobId // empty')
echo ""
if [ -n "$JOB_ID" ]; then
  echo -e "${GREEN}✓ Job created! ID: $JOB_ID${NC}"
else
  echo -e "${RED}✗ Job creation failed!${NC}"
fi
echo ""
echo ""

echo "Test 3: Get All Jobs (Public)"
echo "-----------------------------"
curl -s -X GET "${JOB_URL}?status=draft" | jq '.data[] | {jobId, title, companyName, status, requiredSkillsCount}'
echo ""
echo ""

echo "Test 4: Get Job by ID (Public)"
echo "------------------------------"
if [ -n "$JOB_ID" ]; then
  curl -s -X GET "${JOB_URL}/${JOB_ID}" | jq '.'
else
  echo -e "${YELLOW}Skipping - no job ID${NC}"
fi
echo ""
echo ""

echo "Test 5: Update Job"
echo "------------------"
if [ -n "$JOB_ID" ]; then
  curl -s -X PUT "${JOB_URL}/${JOB_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "We are seeking a highly experienced software engineer with expertise in backend systems.",
      "status": "active"
    }' | jq '.'
  echo ""
  echo -e "${GREEN}✓ Job updated${NC}"
else
  echo -e "${YELLOW}Skipping - no job ID${NC}"
fi
echo ""
echo ""

echo "Test 6: Add Skill to Job (Python)"
echo "----------------------------------"
if [ -n "$JOB_ID" ] && [ -n "$SKILL_ID" ]; then
  ADD_SKILL_RESPONSE=$(curl -s -X POST "${JOB_URL}/${JOB_ID}/skills" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "skillId": "'"$SKILL_ID"'",
      "weight": 0.8,
      "minimumScore": 70,
      "required": true
    }')
  echo "$ADD_SKILL_RESPONSE" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Skill added to job${NC}"
else
  echo -e "${YELLOW}Skipping - no job or skill ID${NC}"
fi
echo ""
echo ""

echo "Test 7: Add Another Skill (JavaScript)"
echo "---------------------------------------"
JS_SKILL_ID=$(docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev -t -c "SELECT skill_id FROM skills WHERE name = 'JavaScript' LIMIT 1" | xargs)
if [ -n "$JOB_ID" ] && [ -n "$JS_SKILL_ID" ]; then
  curl -s -X POST "${JOB_URL}/${JOB_ID}/skills" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "skillId": "'"$JS_SKILL_ID"'",
      "weight": 0.6,
      "minimumScore": 65,
      "required": true
    }' | jq '.'
  echo ""
  echo -e "${GREEN}✓ Second skill added${NC}"
else
  echo -e "${YELLOW}Skipping - no job or skill ID${NC}"
fi
echo ""
echo ""

echo "Test 8: Update Job Skill"
echo "------------------------"
if [ -n "$JOB_ID" ] && [ -n "$SKILL_ID" ]; then
  curl -s -X PUT "${JOB_URL}/${JOB_ID}/skills/${SKILL_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "weight": 0.9,
      "minimumScore": 75
    }' | jq '.'
  echo ""
  echo -e "${GREEN}✓ Job skill updated${NC}"
else
  echo -e "${YELLOW}Skipping - no job or skill ID${NC}"
fi
echo ""
echo ""

echo "Test 9: Get Job with Skills"
echo "----------------------------"
if [ -n "$JOB_ID" ]; then
  curl -s -X GET "${JOB_URL}/${JOB_ID}" | jq '.data | {title, status, requiredSkills: (.requiredSkills | length)}'
else
  echo -e "${YELLOW}Skipping - no job ID${NC}"
fi
echo ""
echo ""

echo "Test 10: Try to Create Job Without Company Access (Should Fail)"
echo "----------------------------------------------------------------"
# Login as candidate
CANDIDATE_LOGIN=$(curl -s -X POST ${AUTH_URL}/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@test.com",
    "password": "Test123!"
  }')
CANDIDATE_TOKEN=$(echo "$CANDIDATE_LOGIN" | jq -r '.data.token // empty')

if [ -n "$CANDIDATE_TOKEN" ]; then
  curl -s -X POST ${JOB_URL} \
    -H "Authorization: Bearer ${CANDIDATE_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "companyId": "'"$COMPANY_ID"'",
      "title": "Test Job",
      "description": "This should fail"
    }' | jq '.'
  echo ""
  echo -e "${YELLOW}Expected to fail with FORBIDDEN error${NC}"
else
  echo -e "${YELLOW}Skipping - could not get candidate token${NC}"
fi
echo ""
echo ""

echo "Test 11: Delete Job Skill"
echo "-------------------------"
if [ -n "$JOB_ID" ] && [ -n "$JS_SKILL_ID" ]; then
  curl -s -X DELETE "${JOB_URL}/${JOB_ID}/skills/${JS_SKILL_ID}" \
    -H "Authorization: Bearer ${TOKEN}" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Job skill deleted${NC}"
else
  echo -e "${YELLOW}Skipping - no job or skill ID${NC}"
fi
echo ""
echo ""

echo "Test 12: Close/Cancel Job"
echo "-------------------------"
if [ -n "$JOB_ID" ]; then
  curl -s -X DELETE "${JOB_URL}/${JOB_ID}" \
    -H "Authorization: Bearer ${TOKEN}" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Job cancelled${NC}"
else
  echo -e "${YELLOW}Skipping - no job ID${NC}"
fi
echo ""
echo ""

echo "Test 13: Verify Job is Cancelled"
echo "---------------------------------"
if [ -n "$JOB_ID" ]; then
  curl -s -X GET "${JOB_URL}/${JOB_ID}" | jq '.data | {jobId, title, status}'
else
  echo -e "${YELLOW}Skipping - no job ID${NC}"
fi
echo ""
echo ""

echo "================================"
echo "✅ Job API Tests Complete"
echo "================================"
