#!/bin/bash

echo "=== Testing Company Profile Management ==="
echo ""

# Login as employer
echo "1. Logging in as employer..."
EMPLOYER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "employer@test.com", "password": "Test123!"}')

EMPLOYER_TOKEN=$(echo "$EMPLOYER_RESPONSE" | jq -r '.data.token')
echo "   Token received: ${EMPLOYER_TOKEN:0:20}..."
echo ""

# Test 1: Create company
echo "2. Creating company profile..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/profiles/company \
  -H "Authorization: Bearer $EMPLOYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company Inc",
    "description": "A test company for JobGraph",
    "website": "https://testcompany.com",
    "industry": "Technology",
    "companySize": "51-200",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  }')

echo "$CREATE_RESPONSE" | jq '.'

# Get company ID (either from create response or from get my company)
COMPANY_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.companyId')
if [ "$COMPANY_ID" = "null" ]; then
  echo "   User already has company, fetching existing ID..."
  GET_RESPONSE=$(curl -s -X GET http://localhost:3001/api/v1/profiles/company \
    -H "Authorization: Bearer $EMPLOYER_TOKEN")
  COMPANY_ID=$(echo "$GET_RESPONSE" | jq -r '.data.companyId')
fi
echo "   Company ID: $COMPANY_ID"
echo ""

# Test 2: Get my company
echo "3. Getting my company..."
curl -s -X GET http://localhost:3001/api/v1/profiles/company \
  -H "Authorization: Bearer $EMPLOYER_TOKEN" | jq '.'
echo ""

# Test 3: Update company
echo "4. Updating company..."
curl -s -X PUT http://localhost:3001/api/v1/profiles/company \
  -H "Authorization: Bearer $EMPLOYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated: A better test company for JobGraph"
  }' | jq '.'
echo ""

# Test 4: Get company by ID (public)
echo "5. Getting company by ID (public endpoint)..."
curl -s -X GET "http://localhost:3001/api/v1/profiles/companies/$COMPANY_ID" | jq '.'
echo ""

# Test 5: List all companies (public)
echo "6. Listing all companies..."
curl -s -X GET "http://localhost:3001/api/v1/profiles/companies?limit=5" | jq '.'
echo ""

echo "=== Company Profile Tests Complete ==="
