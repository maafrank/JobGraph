#!/bin/bash

# Test Auth API Script
echo "🧪 Testing Auth Service API"
echo "=============================="
echo ""

BASE_URL="http://localhost:3000/api/v1/auth"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Test 1: Health Check"
echo "--------------------"
curl -s http://localhost:3000/health | jq '.'
echo ""
echo ""

echo "Test 2: Register New User (Candidate)"
echo "--------------------------------------"
REGISTER_RESPONSE=$(curl -s -X POST ${BASE_URL}/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcandidate@example.com",
    "password": "Test1234!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "candidate"
  }')
echo "$REGISTER_RESPONSE" | jq '.'

# Extract token from registration
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token // empty')
echo ""
if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Registration successful! Token received.${NC}"
else
  echo -e "${RED}✗ Registration failed!${NC}"
fi
echo ""
echo ""

echo "Test 3: Login with New User"
echo "----------------------------"
LOGIN_RESPONSE=$(curl -s -X POST ${BASE_URL}/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcandidate@example.com",
    "password": "Test1234!"
  }')
echo "$LOGIN_RESPONSE" | jq '.'

# Extract token from login
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty')
echo ""
if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✓ Login successful! Token received.${NC}"
else
  echo -e "${RED}✗ Login failed!${NC}"
fi
echo ""
echo ""

echo "Test 4: Get Current User (Protected Route)"
echo "-------------------------------------------"
if [ -n "$TOKEN" ]; then
  curl -s -X GET ${BASE_URL}/me \
    -H "Authorization: Bearer ${TOKEN}" | jq '.'
  echo ""
  echo -e "${GREEN}✓ Protected route accessed successfully!${NC}"
else
  echo -e "${YELLOW}Skipping - no token available${NC}"
fi
echo ""
echo ""

echo "Test 5: Get Current User (No Token - Should Fail)"
echo "--------------------------------------------------"
curl -s -X GET ${BASE_URL}/me | jq '.'
echo ""
echo -e "${YELLOW}Expected to fail with 401 Unauthorized${NC}"
echo ""
echo ""

echo "Test 6: Login with Test User (From Phase 0 Seed)"
echo "-------------------------------------------------"
TEST_LOGIN=$(curl -s -X POST ${BASE_URL}/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@test.com",
    "password": "Test123!"
  }')
echo "$TEST_LOGIN" | jq '.'
echo ""
echo ""

echo "Test 7: Register with Weak Password (Should Fail)"
echo "--------------------------------------------------"
curl -s -X POST ${BASE_URL}/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "weak@example.com",
    "password": "weak",
    "firstName": "Weak",
    "lastName": "Password",
    "role": "candidate"
  }' | jq '.'
echo ""
echo -e "${YELLOW}Expected to fail with WEAK_PASSWORD error${NC}"
echo ""
echo ""

echo "Test 8: Register with Invalid Email (Should Fail)"
echo "--------------------------------------------------"
curl -s -X POST ${BASE_URL}/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "Test1234!",
    "firstName": "Invalid",
    "lastName": "Email",
    "role": "candidate"
  }' | jq '.'
echo ""
echo -e "${YELLOW}Expected to fail with INVALID_EMAIL error${NC}"
echo ""
echo ""

echo "Test 9: Register Duplicate User (Should Fail)"
echo "----------------------------------------------"
curl -s -X POST ${BASE_URL}/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testcandidate@example.com",
    "password": "Test1234!",
    "firstName": "Duplicate",
    "lastName": "User",
    "role": "candidate"
  }' | jq '.'
echo ""
echo -e "${YELLOW}Expected to fail with USER_EXISTS error${NC}"
echo ""
echo ""

echo "=============================="
echo "✅ Auth API Tests Complete"
echo "=============================="
