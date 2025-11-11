# JobGraph - Development Setup

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL client (optional, for direct DB access)
- Git

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Start Docker Services

```bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 3. Set Up Database

```bash
# Load schema
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql

# Seed data
cd backend
npx ts-node ../scripts/seed-data/seed-skills.ts
npx ts-node ../scripts/seed-data/seed-test-users.ts
```

### 4. Configure Environment

The `.env` file has already been created in the backend directory with default local development settings. Modify if needed.

### 5. Build Common Package

```bash
cd backend/common
npm run build
```

### 6. Start Development Servers

```bash
# Backend (when services are ready in Phase 1)
cd backend
npm run dev:auth  # Or other services

# Frontend (when ready)
cd frontend
npm run dev
```

## Available Commands

### Backend

```bash
npm run dev:auth          # Start auth service
npm run dev:profile       # Start profile service
npm run dev:interview     # Start interview service
npm run dev:job           # Start job service
npm run dev:matching      # Start matching service
npm run dev:notification  # Start notification service
npm run test              # Run tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run lint              # Lint code
npm run format            # Format code with Prettier
```

### Docker

```bash
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose logs -f    # View logs
docker-compose ps         # Check service status
```

## Database Access

### Using Adminer (Web UI)
- Open http://localhost:8080
- Server: postgres
- Username: postgres
- Password: postgres
- Database: jobgraph_dev

### Using psql
```bash
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev
```

## Test Credentials

Once you've run the seed scripts:

- Candidate: candidate@test.com / Test123!
- Employer: employer@test.com / Test123!
- Admin: admin@test.com / Admin123!

## Project Structure

```
JobGraph/
├── backend/
│   ├── common/               # Shared utilities, types, database
│   │   └── src/
│   │       ├── database/     # Database connection and helpers
│   │       ├── types/        # TypeScript interfaces
│   │       └── utils/        # Utility functions
│   ├── services/             # Microservices
│   │   ├── auth-service/
│   │   ├── profile-service/
│   │   ├── interview-service/
│   │   ├── job-service/
│   │   ├── matching-service/
│   │   └── notification-service/
│   ├── tests/                # Test files
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json          # Workspace config
│   ├── tsconfig.json         # TypeScript config
│   ├── jest.config.js        # Jest config
│   └── .env                  # Environment variables
├── frontend/                 # React frontend (Phase 1)
├── infrastructure/           # AWS CDK (Phase 4)
├── scripts/                  # Utility scripts
│   └── seed-data/           # Database seed scripts
├── docker-compose.yml        # Local development services
└── DATABASE_SCHEMA.sql       # Database schema

```

## Running Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- utils.test.ts
```

## Troubleshooting

### Port conflicts
If ports 3000, 5432, 6379, or 8080 are in use:
- Stop conflicting services
- Or modify ports in docker-compose.yml

### Database connection issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Clear everything and start fresh
```bash
docker-compose down -v
docker-compose up -d
# Re-run database setup steps
```

### TypeScript compilation errors
```bash
cd backend/common
npm run build

# Or watch for changes
npm run dev
```

## Next Steps

1. Phase 0 is complete! You now have:
   - Backend structure with microservices architecture
   - Database and Redis running in Docker
   - Common utilities for database, auth, and validation
   - Testing infrastructure with Jest
   - Development environment ready

2. Move to Phase 1: MVP
   - Start with Auth Service implementation
   - Create first API endpoints
   - Set up Express servers for each service

3. See [EXECUTION_PLAN.md](EXECUTION_PLAN.md) for detailed roadmap

## Additional Resources

- [System Design](./SYSTEM_DESIGN.md) - Architecture overview
- [Database Schema](./DATABASE_SCHEMA.sql) - Complete schema
- [Execution Plan](./EXECUTION_PLAN.md) - Implementation roadmap
- [Claude Guidelines](./CLAUDE.md) - Development instructions
