#!/bin/bash

# Test Profile API Script
echo "🧪 Testing Profile Service API"
echo "================================"
echo ""

AUTH_URL="http://localhost:3000/api/v1/auth"
PROFILE_URL="http://localhost:3001/api/v1/profiles"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Test 0: Health Check"
echo "--------------------"
curl -s http://localhost:3001/health | jq '.'
echo ""
echo ""

echo "Test 1: Login as Candidate"
echo "--------------------------"
LOGIN_RESPONSE=$(curl -s -X POST ${AUTH_URL}/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@test.com",
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

echo "Test 2: Get Candidate Profile"
echo "------------------------------"
PROFILE_RESPONSE=$(curl -s -X GET ${PROFILE_URL}/candidate \
  -H "Authorization: Bearer ${TOKEN}")
echo "$PROFILE_RESPONSE" | jq '.'
echo ""
echo ""

echo "Test 3: Update Profile (Add Headline & Summary)"
echo "------------------------------------------------"
curl -s -X PUT ${PROFILE_URL}/candidate \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "Full Stack Developer with 5 years experience",
    "summary": "Experienced software engineer specializing in Node.js and React",
    "yearsExperience": 5,
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "willingToRelocate": true,
    "remotePreference": "hybrid",
    "profileVisibility": "public"
  }' | jq '.'
echo ""
echo ""

echo "Test 4: Add Education"
echo "---------------------"
EDU_RESPONSE=$(curl -s -X POST ${PROFILE_URL}/candidate/education \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "degree": "Bachelor of Science",
    "fieldOfStudy": "Computer Science",
    "institution": "University of California, Berkeley",
    "graduationYear": 2018,
    "gpa": 3.8
  }')
echo "$EDU_RESPONSE" | jq '.'

EDU_ID=$(echo "$EDU_RESPONSE" | jq -r '.data.educationId // empty')
echo ""
if [ -n "$EDU_ID" ]; then
  echo -e "${GREEN}✓ Education added! ID: $EDU_ID${NC}"
fi
echo ""
echo ""

echo "Test 5: Add Another Education"
echo "-----------------------------"
curl -s -X POST ${PROFILE_URL}/candidate/education \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "degree": "Master of Science",
    "fieldOfStudy": "Software Engineering",
    "institution": "Stanford University",
    "graduationYear": 2020,
    "gpa": 3.9
  }' | jq '.'
echo ""
echo ""

echo "Test 6: Update Education"
echo "------------------------"
if [ -n "$EDU_ID" ]; then
  curl -s -X PUT ${PROFILE_URL}/candidate/education/${EDU_ID} \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "gpa": 3.85
    }' | jq '.'
  echo ""
  echo -e "${GREEN}✓ Education updated${NC}"
else
  echo -e "${YELLOW}Skipping - no education ID${NC}"
fi
echo ""
echo ""

echo "Test 7: Add Work Experience"
echo "----------------------------"
EXP_RESPONSE=$(curl -s -X POST ${PROFILE_URL}/candidate/experience \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Software Engineer",
    "company": "Tech Corp",
    "startDate": "2020-06-01",
    "endDate": "2023-12-31",
    "isCurrent": false,
    "description": "Led development of microservices architecture using Node.js and AWS"
  }')
echo "$EXP_RESPONSE" | jq '.'

EXP_ID=$(echo "$EXP_RESPONSE" | jq -r '.data.experienceId // empty')
echo ""
if [ -n "$EXP_ID" ]; then
  echo -e "${GREEN}✓ Work experience added! ID: $EXP_ID${NC}"
fi
echo ""
echo ""

echo "Test 8: Add Current Work Experience"
echo "------------------------------------"
curl -s -X POST ${PROFILE_URL}/candidate/experience \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Lead Software Engineer",
    "company": "Startup Inc",
    "startDate": "2024-01-01",
    "isCurrent": true,
    "description": "Building scalable job matching platform"
  }' | jq '.'
echo ""
echo ""

echo "Test 9: Update Work Experience"
echo "-------------------------------"
if [ -n "$EXP_ID" ]; then
  curl -s -X PUT ${PROFILE_URL}/candidate/experience/${EXP_ID} \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Led development of microservices architecture using Node.js, React, and AWS. Managed team of 5 engineers."
    }' | jq '.'
  echo ""
  echo -e "${GREEN}✓ Work experience updated${NC}"
else
  echo -e "${YELLOW}Skipping - no experience ID${NC}"
fi
echo ""
echo ""

echo "Test 10: Get Complete Profile (with Education & Experience)"
echo "------------------------------------------------------------"
curl -s -X GET ${PROFILE_URL}/candidate \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""
echo ""

echo "Test 11: Try to Access Without Token (Should Fail)"
echo "----------------------------------------------------"
curl -s -X GET ${PROFILE_URL}/candidate | jq '.'
echo ""
echo -e "${YELLOW}Expected to fail with 401 Unauthorized${NC}"
echo ""
echo ""

echo "Test 12: Delete Education"
echo "-------------------------"
if [ -n "$EDU_ID" ]; then
  curl -s -X DELETE ${PROFILE_URL}/candidate/education/${EDU_ID} \
    -H "Authorization: Bearer ${TOKEN}" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Education deleted${NC}"
else
  echo -e "${YELLOW}Skipping - no education ID${NC}"
fi
echo ""
echo ""

echo "Test 13: Delete Work Experience"
echo "--------------------------------"
if [ -n "$EXP_ID" ]; then
  curl -s -X DELETE ${PROFILE_URL}/candidate/experience/${EXP_ID} \
    -H "Authorization: Bearer ${TOKEN}" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Work experience deleted${NC}"
else
  echo -e "${YELLOW}Skipping - no experience ID${NC}"
fi
echo ""
echo ""

echo "Test 14: Verify Profile After Deletions"
echo "----------------------------------------"
curl -s -X GET ${PROFILE_URL}/candidate \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data | {headline, education: (.education | length), workExperience: (.workExperience | length)}'
echo ""
echo ""

echo "================================"
echo "✅ Profile API Tests Complete"
echo "================================"
