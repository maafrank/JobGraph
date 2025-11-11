#!/bin/bash

echo "=== Testing Auth Enhancements ==="
echo ""

# Test 1: Login and get refresh token
echo "1. Testing login with refresh token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "candidate@test.com", "password": "Test123!"}')

echo "$LOGIN_RESPONSE" | jq '.'

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken')

echo "   Access Token: ${ACCESS_TOKEN:0:20}..."
echo "   Refresh Token: ${REFRESH_TOKEN:0:20}..."
echo ""

# Test 2: Use refresh token to get new access token
echo "2. Testing refresh token endpoint..."
sleep 2 # Small delay to ensure token timestamp is different

REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

echo "$REFRESH_RESPONSE" | jq '.'

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.token')
echo "   New Access Token: ${NEW_ACCESS_TOKEN:0:20}..."
echo ""

# Test 3: Test logout (revoke refresh token)
echo "3. Testing logout endpoint..."
LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

echo "$LOGOUT_RESPONSE" | jq '.'
echo ""

# Test 4: Try to use revoked refresh token (should fail)
echo "4. Testing revoked refresh token (should fail)..."
REVOKED_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

echo "$REVOKED_RESPONSE" | jq '.'
echo ""

# Test 5: Register new user and check email verified status
echo "5. Testing registration with email_verified field..."
RANDOM_NUM=$RANDOM
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test${RANDOM_NUM}@test.com\",
    \"password\": \"Test123!\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"role\": \"candidate\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

NEW_USER_EMAIL=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.email')
EMAIL_VERIFIED=$(echo "$REGISTER_RESPONSE" | jq -r '.data.user.emailVerified')
echo "   Email: $NEW_USER_EMAIL"
echo "   Email Verified: $EMAIL_VERIFIED"
echo ""

# Test 6: Manually create verification token for testing
echo "6. Setting up email verification token for testing..."
VERIFICATION_TOKEN=$(openssl rand -hex 32)
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev -c \
  "UPDATE users
   SET email_verification_token = '$VERIFICATION_TOKEN',
       email_verification_expires_at = NOW() + INTERVAL '24 hours'
   WHERE email = '$NEW_USER_EMAIL'" > /dev/null

echo "   Verification Token: ${VERIFICATION_TOKEN:0:20}..."
echo ""

# Test 7: Verify email with token
echo "7. Testing email verification endpoint..."
VERIFY_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$VERIFICATION_TOKEN\"}")

echo "$VERIFY_RESPONSE" | jq '.'
echo ""

# Test 8: Try to verify with same token again (should fail)
echo "8. Testing already verified email (should fail)..."
VERIFY_AGAIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$VERIFICATION_TOKEN\"}")

echo "$VERIFY_AGAIN_RESPONSE" | jq '.'
echo ""

# Test 9: Test invalid refresh token
echo "9. Testing invalid refresh token (should fail)..."
INVALID_REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "invalid-token-12345"}')

echo "$INVALID_REFRESH_RESPONSE" | jq '.'
echo ""

# Test 10: Test logout with invalid token
echo "10. Testing logout with invalid token..."
INVALID_LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "invalid-token-12345"}')

echo "$INVALID_LOGOUT_RESPONSE" | jq '.'
echo ""

echo "=== Auth Enhancement Tests Complete ==="
