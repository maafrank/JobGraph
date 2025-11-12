# JobGraph - Quick Start Guide

Fast setup and testing reference for Phase 0.

## 🚀 First Time Setup

```bash
# 1. Start Docker Desktop (must be running!)

# 2. Start services
docker-compose up -d

# 3. Quick setup (runs all setup steps)
./scripts/setup-database.sh

# 4. Install dependencies
cd backend && npm install

# 5. Build common package
cd common && npm run build

# 6. Test everything
cd .. && npm test
```

## ✅ Quick Test

```bash
# Run automated test suite
./scripts/test-phase0.sh
```

## 📋 Quick Reference

### Essential Commands

```bash
# Start/Stop
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose ps           # Check status

# Database
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev
# Adminer UI: http://localhost:8080

# Backend
cd backend
npm test                    # Run tests
npm run lint               # Lint code
npm run format             # Format code
cd common && npm run build # Build common package

# Seed Data
cd backend
npx ts-node ../scripts/seed-data/seed-skills.ts
npx ts-node ../scripts/seed-data/seed-test-users.ts
```

### Test Credentials

Once seeded:
- **Candidate**: `candidate@test.com` / `Test123!`
- **Employer**: `employer@test.com` / `Test123!`
- **Admin**: `admin@test.com` / `Admin123!`

### Key URLs

- **Adminer**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Adminer Login

- System: PostgreSQL
- Server: postgres
- Username: postgres
- Password: postgres
- Database: jobgraph_dev

## 🔧 Troubleshooting

### Quick Fixes

```bash
# Docker not running?
# → Start Docker Desktop app

# No tables in database?
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql

# Tests failing?
cd backend/common && npm run build  # Rebuild common package
cd .. && npm test                   # Try again

# Port conflicts?
docker-compose down                 # Stop everything
lsof -i :5432                      # Check what's using ports
# Kill conflicting process or change ports in docker-compose.yml

# Nuclear reset?
docker-compose down -v              # Delete everything
docker-compose up -d                # Start fresh
./scripts/setup-database.sh         # Re-setup
```

## 📁 Project Structure

```
JobGraph/
├── backend/
│   ├── common/          # @jobgraph/common package
│   │   ├── src/
│   │   │   ├── database/   # DB connections
│   │   │   ├── types/      # TypeScript types
│   │   │   └── utils/      # Utilities
│   │   └── dist/           # Compiled JS
│   ├── services/        # Microservices (Phase 1+)
│   ├── tests/          # Test files
│   └── package.json    # Workspace root
├── scripts/            # Setup & seed scripts
├── docker-compose.yml  # Local services
└── DATABASE_SCHEMA.sql # Database schema
```

## 📖 Documentation

- **[TESTING_PHASE_0.md](TESTING_PHASE_0.md)** - Detailed testing guide
- **[DEV_SETUP.md](DEV_SETUP.md)** - Full setup instructions
- **[PHASE_0_CHECKLIST.md](PHASE_0_CHECKLIST.md)** - Completion checklist
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines
- **[EXECUTION_PLAN.md](EXECUTION_PLAN.md)** - Full roadmap

## ✨ Next Steps

Once Phase 0 tests pass:

1. **Review architecture**: Read [CLAUDE.md](CLAUDE.md)
2. **Start Phase 1**: Begin with Auth Service
3. **See roadmap**: [EXECUTION_PLAN.md](EXECUTION_PLAN.md)

---

**Questions?** See [TESTING_PHASE_0.md](TESTING_PHASE_0.md) for detailed troubleshooting.
