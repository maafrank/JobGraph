# Testing Phase 0 - Complete Guide

This guide helps you verify that all Phase 0 components are working correctly.

## Quick Test (Automated)

**Prerequisites**: Docker Desktop must be running

```bash
# Run the automated test script
./scripts/test-phase0.sh
```

This script will:
- ✓ Check Docker daemon status
- ✓ Verify all containers are running
- ✓ Test PostgreSQL and Redis connections
- ✓ Verify database schema is loaded
- ✓ Check seed data exists
- ✓ Validate backend dependencies
- ✓ Verify common package is built
- ✓ Run Jest unit tests
- ✓ Check Adminer accessibility

---

## Manual Testing Steps

If you prefer to test manually or if the automated script fails:

### 1. Start Docker Desktop

**Mac**: Open Docker Desktop application from Applications
**Windows**: Start Docker Desktop from Start Menu

Wait for Docker to fully start (whale icon should be steady).

### 2. Start Services

```bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps

# You should see:
# - jobgraph-postgres (port 5432)
# - jobgraph-redis (port 6379)
# - jobgraph-adminer (port 8080)
```

**Expected Output**:
```
NAME                 IMAGE              STATUS
jobgraph-postgres    postgres:15-alpine Up
jobgraph-redis       redis:7-alpine     Up
jobgraph-adminer     adminer:latest     Up
```

### 3. Test PostgreSQL Connection

```bash
# Test connection
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "SELECT version();"

# Should return PostgreSQL version info
```

**Expected**: Version string like `PostgreSQL 15.x on...`

### 4. Test Redis Connection

```bash
# Test Redis
docker exec -it jobgraph-redis redis-cli ping

# Should return: PONG
```

**Expected**: `PONG`

### 5. Verify Database Schema

```bash
# Check if tables exist
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "\dt"

# Should list all tables
```

**Expected Tables**:
- users
- candidate_profiles
- companies
- skills
- jobs
- job_skills
- interviews
- interview_templates
- questions
- And more...

**If tables are missing**, load the schema:
```bash
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql
```

### 6. Check Seed Data

```bash
# Check skills
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "SELECT COUNT(*) FROM skills;"

# Should show ~35 skills

# Check test users
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "SELECT email, role FROM users;"

# Should show 3 test users
```

**Expected Output**:
```
           email           |   role
---------------------------+-----------
 candidate@test.com        | candidate
 employer@test.com         | employer
 admin@test.com            | admin
```

**If seed data is missing**, run:
```bash
cd backend
npx ts-node ../scripts/seed-data/seed-skills.ts
npx ts-node ../scripts/seed-data/seed-test-users.ts
```

### 7. Test Backend Dependencies

```bash
cd backend

# Check if node_modules exists
ls node_modules | head -5

# Should list packages
```

**If missing**, install:
```bash
npm install
```

### 8. Test Common Package Build

```bash
cd backend/common

# Check if dist directory exists
ls dist

# Should show compiled JavaScript files
```

**Expected Files**:
- index.js
- database/index.js
- types/index.js
- utils/index.js
- Plus .d.ts declaration files

**If missing**, build:
```bash
npm run build
```

### 9. Run Unit Tests

```bash
cd backend

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

**Expected Output**:
```
PASS tests/unit/utils.test.ts
  Utils
    Password hashing
      ✓ should hash password correctly
      ✓ should verify correct password
      ✓ should reject incorrect password
    Email validation
      ✓ should validate correct email
      ✓ should reject invalid email
    Password validation
      ✓ should validate strong password
      ✓ should reject weak password

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

### 10. Test Adminer Web UI

```bash
# Open in browser
open http://localhost:8080
# Or manually visit: http://localhost:8080
```

**Login Credentials**:
- System: PostgreSQL
- Server: postgres
- Username: postgres
- Password: postgres
- Database: jobgraph_dev

**What to verify**:
- Can login successfully
- Can see all tables in left sidebar
- Can browse `users` table and see 3 test users
- Can browse `skills` table and see ~35 skills

### 11. Test Database Connection from Code

Create a quick test file:

```bash
# Create test file
cat > backend/test-connection.ts << 'EOF'
import { testDatabaseConnection, testRedisConnection } from './common/src/database';

async function test() {
  console.log('Testing database connections...\n');

  await testDatabaseConnection();
  await testRedisConnection();

  console.log('\n✅ All connections successful!');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Connection test failed:', err);
  process.exit(1);
});
EOF

# Run test
npx ts-node backend/test-connection.ts
```

**Expected Output**:
```
Testing database connections...

✓ Database connected: 2025-11-10T...
✓ Redis connected

✅ All connections successful!
```

---

## Verification Checklist

Use this checklist to confirm everything is working:

- [ ] Docker Desktop is running
- [ ] All 3 containers are up (postgres, redis, adminer)
- [ ] PostgreSQL accepts connections
- [ ] Redis responds to PING
- [ ] Database has all tables from schema
- [ ] Skills table has ~35 records
- [ ] Users table has 3 test users
- [ ] Backend dependencies installed (node_modules exists)
- [ ] Common package built (dist/ directory exists)
- [ ] Jest tests pass (7/7 passing)
- [ ] Adminer accessible at localhost:8080
- [ ] Can query database from code

---

## Troubleshooting

### Docker won't start
**Problem**: `Cannot connect to the Docker daemon`
**Solution**: Start Docker Desktop application and wait for it to fully load

### PostgreSQL not accepting connections
**Problem**: `psql: error: connection refused`
**Solution**:
```bash
docker-compose restart postgres
sleep 10
# Try again
```

### Database has no tables
**Problem**: `\dt` shows "Did not find any relations"
**Solution**: Load schema:
```bash
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql
```

### Seed scripts fail
**Problem**: `Cannot find module '@jobgraph/common'`
**Solution**: Build common package first:
```bash
cd backend/common && npm run build
```

### Tests fail
**Problem**: Jest tests failing
**Solution**: Check specific error messages. Common issues:
- Database not running: Start Docker services
- Common package not built: Run `cd backend/common && npm run build`
- Dependencies missing: Run `cd backend && npm install`

### Port conflicts
**Problem**: "Port 5432 already in use"
**Solution**:
```bash
# Find what's using the port
lsof -i :5432

# Stop the conflicting service or change port in docker-compose.yml
```

### Clear everything and restart
```bash
# Nuclear option - completely reset
docker-compose down -v
docker-compose up -d
sleep 10

# Reload schema and seed data
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql
cd backend
npx ts-node ../scripts/seed-data/seed-skills.ts
npx ts-node ../scripts/seed-data/seed-test-users.ts
```

---

## Success Criteria

Phase 0 is complete when:
1. ✅ All automated tests pass
2. ✅ All Docker services running healthy
3. ✅ Database fully seeded
4. ✅ Backend builds without errors
5. ✅ Unit tests all passing

**Next Step**: Proceed to Phase 1 (Auth Service implementation)
