# Phase 0: Foundation - Detailed Implementation Plan

**Timeline**: Week 1-2 (10-14 days)
**Goal**: Set up complete development environment, repository structure, database, and tooling

---

## Day 1-2: Repository Structure & Backend Setup

### 1.1 Create Directory Structure

```bash
# From project root (/Users/matthewfrank/Documents/Business/JobGraph)

# Backend structure
mkdir -p backend/services/auth-service/src
mkdir -p backend/services/profile-service/src
mkdir -p backend/services/interview-service/src
mkdir -p backend/services/job-service/src
mkdir -p backend/services/matching-service/src
mkdir -p backend/services/notification-service/src

# Common shared code
mkdir -p backend/common/database
mkdir -p backend/common/utils
mkdir -p backend/common/types
mkdir -p backend/common/middleware

# Frontend
mkdir -p frontend/src/components
mkdir -p frontend/src/pages
mkdir -p frontend/src/hooks
mkdir -p frontend/src/services
mkdir -p frontend/src/store
mkdir -p frontend/src/types
mkdir -p frontend/src/utils

# Infrastructure
mkdir -p infrastructure/lib
mkdir -p infrastructure/bin

# Scripts for development tasks
mkdir -p scripts/seed-data
mkdir -p scripts/migrations

# Documentation (already exists, but ensure it's there)
mkdir -p docs

# Tests
mkdir -p backend/tests/integration
mkdir -p backend/tests/unit
mkdir -p frontend/tests
```

### 1.2 Choose Backend Language & Initialize

**Decision Point**: Choose Node.js (TypeScript) OR Python (FastAPI)

#### Option A: Node.js + TypeScript (Recommended for this project)

**Why Node.js**:
- Better ecosystem for microservices
- Easier AWS Lambda integration
- Same language as frontend (TypeScript)
- Excellent tooling and libraries

**Setup**:
```bash
# Initialize backend workspace
cd backend
npm init -y

# Create workspace package.json for monorepo management
cat > package.json << 'EOF'
{
  "name": "jobgraph-backend",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "services/*",
    "common"
  ],
  "scripts": {
    "dev:auth": "npm run dev --workspace=services/auth-service",
    "dev:profile": "npm run dev --workspace=services/profile-service",
    "dev:interview": "npm run dev --workspace=services/interview-service",
    "dev:job": "npm run dev --workspace=services/job-service",
    "dev:matching": "npm run dev --workspace=services/matching-service",
    "dev:notification": "npm run dev --workspace=services/notification-service",
    "test": "npm run test --workspaces",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"**/*.{ts,json,md}\""
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "prettier": "^3.0.0",
    "typescript": "^5.2.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0"
  }
}
EOF

# Install root dependencies
npm install
```

**Initialize Common Package**:
```bash
cd backend/common

cat > package.json << 'EOF'
{
  "name": "@jobgraph/common",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "pg": "^8.11.0",
    "ioredis": "^5.3.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "@types/jsonwebtoken": "^9.0.3",
    "@types/bcrypt": "^5.0.0"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

npm install
```

**Initialize Auth Service** (template for all services):
```bash
cd backend/services/auth-service

cat > package.json << 'EOF'
{
  "name": "@jobgraph/auth-service",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@jobgraph/common": "*",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "dotenv": "^16.3.0",
    "express-rate-limit": "^7.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^2.0.0"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF

npm install
```

#### Option B: Python + FastAPI (Alternative)

**Setup** (if choosing Python):
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.104.0
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
redis==5.0.1
pydantic==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
python-dotenv==1.0.0
alembic==1.13.0
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.0
EOF

pip install -r requirements.txt

# Create dev requirements
cat > requirements-dev.txt << 'EOF'
-r requirements.txt
black==23.11.0
flake8==6.1.0
mypy==1.7.0
pytest-cov==4.1.0
ruff==0.1.6
EOF

pip install -r requirements-dev.txt
```

**For this plan, we'll proceed with Node.js + TypeScript** (more common for full-stack developers)

---

## Day 2-3: Root Configuration Files

### 2.1 TypeScript Configuration (Root)

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph/backend

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node", "jest"],
    "baseUrl": ".",
    "paths": {
      "@jobgraph/common": ["./common/src"]
    }
  },
  "include": ["services/**/*", "common/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF
```

### 2.2 ESLint Configuration

```bash
cat > .eslintrc.json << 'EOF'
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
EOF
```

### 2.3 Prettier Configuration

```bash
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
EOF

cat > .prettierignore << 'EOF'
node_modules
dist
build
coverage
.env
*.log
EOF
```

### 2.4 Environment Variables Template

```bash
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jobgraph_dev
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=jobgraph_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# API
PORT=3000
NODE_ENV=development
API_BASE_URL=http://localhost:3000

# AWS (for later phases)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_RESUMES=jobgraph-resumes-dev

# Email (for later)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
EOF

# Create actual .env file (will be in .gitignore)
cp .env.example .env
```

### 2.5 Git Configuration

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph

# Update .gitignore
cat >> .gitignore << 'EOF'

# JobGraph specific
.env
.env.local
.env.*.local

# Dependencies
node_modules/
package-lock.json

# Build outputs
dist/
build/
*.tsbuildinfo

# Tests
coverage/
.nyc_output/

# Database
*.db
*.sqlite

# Logs
logs/
*.log
npm-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Temp files
tmp/
temp/
EOF
```

---

## Day 3-4: Docker & Database Setup

### 3.1 Docker Compose for Local Development

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph

cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: jobgraph-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: jobgraph_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./DATABASE_SCHEMA.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: jobgraph-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Adminer - Database GUI (optional but helpful)
  adminer:
    image: adminer:latest
    container_name: jobgraph-adminer
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    environment:
      ADMINER_DEFAULT_SERVER: postgres

volumes:
  postgres_data:
  redis_data:
EOF
```

### 3.2 Start Docker Services

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f postgres

# Verify services are running
docker-compose ps

# Test PostgreSQL connection
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "SELECT version();"

# Test Redis connection
docker exec -it jobgraph-redis redis-cli ping
```

### 3.3 Database Migration Tool Setup

```bash
cd backend

# Install migration tool
npm install --save-dev node-pg-migrate

# Create migrations directory
mkdir -p migrations

# Add migration scripts to package.json
npm pkg set scripts.migrate:up="node-pg-migrate up"
npm pkg set scripts.migrate:down="node-pg-migrate down"
npm pkg set scripts.migrate:create="node-pg-migrate create"

# Create migration config
cat > migrations/config.json << 'EOF'
{
  "database_url": {
    "ENV": "DATABASE_URL"
  },
  "migrations_table": "pgmigrations",
  "dir": "migrations",
  "schema": "public"
}
EOF

# Create initial migration (copy from DATABASE_SCHEMA.sql)
npm run migrate:create initial-schema

# The migration file will be in migrations/ - we'll populate it next
```

### 3.4 Convert DATABASE_SCHEMA.sql to Migration

```bash
# Create the first migration file
# Find the created file (it will have a timestamp)
MIGRATION_FILE=$(ls -t backend/migrations/*.js | head -1)

cat > "$MIGRATION_FILE" << 'EOF'
exports.up = (pgm) => {
  // Enable UUID extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Users table
  pgm.createTable('users', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    phone: { type: 'varchar(20)' },
    role: {
      type: 'varchar(20)',
      notNull: true,
      check: "role IN ('candidate', 'employer', 'admin')",
    },
    email_verified: { type: 'boolean', default: false },
    active: { type: 'boolean', default: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'role');

  // Add more tables from DATABASE_SCHEMA.sql...
  // (For brevity, showing structure - you'll need to add all tables)
};

exports.down = (pgm) => {
  pgm.dropTable('users', { cascade: true });
  // Drop other tables in reverse order...
};
EOF

# Run migration
cd backend
npm run migrate:up
```

**Note**: For Phase 0, we can also directly load the DATABASE_SCHEMA.sql file:

```bash
# Alternative: Load schema directly (simpler for Phase 0)
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql

# Verify tables were created
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "\dt"
```

---

## Day 4-5: Database Connection & Common Utilities

### 4.1 Create Database Connection Module

```bash
cd backend/common/src
mkdir -p database

cat > database/index.ts << 'EOF'
import { Pool, PoolClient } from 'pg';
import { Redis } from 'ioredis';

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'jobgraph_dev',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✓ Database connected:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    console.log('✓ Redis connected');
    return true;
  } catch (error) {
    console.error('✗ Redis connection failed:', error);
    return false;
  }
}

// Query helper with error handling
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Transaction helper
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export { pool, redis };
EOF
```

### 4.2 Create Common Types

```bash
cat > types/index.ts << 'EOF'
// User types
export interface User {
  user_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'candidate' | 'employer' | 'admin';
  email_verified: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CandidateProfile {
  profile_id: string;
  user_id: string;
  headline?: string;
  summary?: string;
  years_experience?: number;
  resume_url?: string;
  resume_parsed_data?: Record<string, any>;
  city?: string;
  state?: string;
  country?: string;
  willing_to_relocate: boolean;
  remote_preference?: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  profile_visibility: 'public' | 'private' | 'anonymous';
  created_at: Date;
  updated_at: Date;
}

export interface Skill {
  skill_id: string;
  name: string;
  category: string;
  description?: string;
  active: boolean;
  created_at: Date;
}

export interface Job {
  job_id: string;
  company_id: string;
  posted_by: string;
  title: string;
  description: string;
  requirements?: string;
  city?: string;
  state?: string;
  country?: string;
  remote_option?: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  employment_type?: 'full-time' | 'part-time' | 'contract' | 'internship';
  experience_level?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  views: number;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// JWT Payload
export interface JwtPayload {
  user_id: string;
  email: string;
  role: string;
}
EOF
```

### 4.3 Create Common Utilities

```bash
cat > utils/index.ts << 'EOF'
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT tokens
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// Validation helpers
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Error handling
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// API Response formatter
export function successResponse<T>(data: T, pagination?: any) {
  return {
    success: true,
    data,
    ...(pagination && { pagination }),
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: any
) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}
EOF
```

### 4.4 Build Common Package

```bash
cd backend/common
npm run build

# Verify build
ls -la dist/
```

---

## Day 5-6: Seed Data Scripts

### 5.1 Create Seed Script for Skills

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph/scripts/seed-data

cat > seed-skills.ts << 'EOF'
import { pool } from '../../backend/common/src/database';

const skills = [
  // Programming Languages
  { name: 'Python', category: 'programming', description: 'Python programming language' },
  { name: 'JavaScript', category: 'programming', description: 'JavaScript programming language' },
  { name: 'TypeScript', category: 'programming', description: 'TypeScript programming language' },
  { name: 'Java', category: 'programming', description: 'Java programming language' },
  { name: 'C++', category: 'programming', description: 'C++ programming language' },
  { name: 'Go', category: 'programming', description: 'Go programming language' },
  { name: 'Rust', category: 'programming', description: 'Rust programming language' },
  { name: 'SQL', category: 'programming', description: 'Structured Query Language' },

  // Data Science & ML
  { name: 'Machine Learning', category: 'data_science', description: 'Machine learning algorithms and frameworks' },
  { name: 'Data Engineering', category: 'data_science', description: 'Building data pipelines and infrastructure' },
  { name: 'Data Analysis', category: 'data_science', description: 'Analyzing and interpreting data' },
  { name: 'Deep Learning', category: 'data_science', description: 'Neural networks and deep learning' },
  { name: 'NLP', category: 'data_science', description: 'Natural Language Processing' },
  { name: 'Computer Vision', category: 'data_science', description: 'Image and video analysis' },

  // AI & Prompt Engineering
  { name: 'Prompt Engineering', category: 'ai', description: 'Creating effective prompts for LLMs' },
  { name: 'LLM Applications', category: 'ai', description: 'Building applications with large language models' },

  // Web Development
  { name: 'React', category: 'web_development', description: 'React JavaScript library' },
  { name: 'Node.js', category: 'web_development', description: 'Node.js runtime' },
  { name: 'Vue.js', category: 'web_development', description: 'Vue.js framework' },
  { name: 'Angular', category: 'web_development', description: 'Angular framework' },
  { name: 'Django', category: 'web_development', description: 'Django web framework' },
  { name: 'FastAPI', category: 'web_development', description: 'FastAPI framework' },

  // Cloud & DevOps
  { name: 'AWS', category: 'cloud', description: 'Amazon Web Services cloud platform' },
  { name: 'Azure', category: 'cloud', description: 'Microsoft Azure cloud platform' },
  { name: 'GCP', category: 'cloud', description: 'Google Cloud Platform' },
  { name: 'Docker', category: 'devops', description: 'Container platform' },
  { name: 'Kubernetes', category: 'devops', description: 'Container orchestration' },
  { name: 'CI/CD', category: 'devops', description: 'Continuous Integration and Deployment' },

  // Databases
  { name: 'PostgreSQL', category: 'database', description: 'PostgreSQL relational database' },
  { name: 'MongoDB', category: 'database', description: 'MongoDB NoSQL database' },
  { name: 'Redis', category: 'database', description: 'Redis in-memory data store' },

  // Finance
  { name: 'Financial Analysis', category: 'finance', description: 'Analyzing financial data and markets' },
  { name: 'Financial Modeling', category: 'finance', description: 'Building financial models' },
  { name: 'Risk Management', category: 'finance', description: 'Financial risk assessment and management' },
];

async function seedSkills() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding skills...');

    for (const skill of skills) {
      await client.query(
        `INSERT INTO skills (name, category, description, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO NOTHING`,
        [skill.name, skill.category, skill.description]
      );
    }

    const result = await client.query('SELECT COUNT(*) FROM skills');
    console.log(`✓ Seeded ${result.rows[0].count} skills`);

  } catch (error) {
    console.error('Error seeding skills:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSkills();
EOF

# Make it executable
chmod +x seed-skills.ts

# Run seed script
cd /Users/matthewfrank/Documents/Business/JobGraph
npx ts-node scripts/seed-data/seed-skills.ts
```

### 5.2 Create Seed Script for Test Users

```bash
cat > scripts/seed-data/seed-test-users.ts << 'EOF'
import { pool } from '../../backend/common/src/database';
import { hashPassword } from '../../backend/common/src/utils';

async function seedTestUsers() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding test users...');

    // Test candidate
    const candidatePassword = await hashPassword('Test123!');
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['candidate@test.com', candidatePassword, 'Test', 'Candidate', 'candidate', true]
    );

    // Test employer
    const employerPassword = await hashPassword('Test123!');
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['employer@test.com', employerPassword, 'Test', 'Employer', 'employer', true]
    );

    // Test admin
    const adminPassword = await hashPassword('Admin123!');
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@test.com', adminPassword, 'Test', 'Admin', 'admin', true]
    );

    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`✓ Seeded ${result.rows[0].count} users`);
    console.log('\nTest credentials:');
    console.log('  Candidate: candidate@test.com / Test123!');
    console.log('  Employer: employer@test.com / Test123!');
    console.log('  Admin: admin@test.com / Admin123!');

  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestUsers();
EOF

chmod +x scripts/seed-data/seed-test-users.ts
```

---

## Day 6-7: Testing Infrastructure

### 6.1 Jest Configuration

```bash
cd backend

cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/services'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@jobgraph/common$': '<rootDir>/common/src',
  },
  collectCoverageFrom: [
    'services/**/*.ts',
    'common/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
EOF
```

### 6.2 Create Sample Test

```bash
mkdir -p backend/tests/unit

cat > backend/tests/unit/utils.test.ts << 'EOF'
import {
  hashPassword,
  comparePassword,
  isValidEmail,
  isValidPassword,
} from '../../common/src/utils';

describe('Utils', () => {
  describe('Password hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword('WrongPassword!', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Email validation', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('Password validation', () => {
    it('should validate strong password', () => {
      expect(isValidPassword('Test123!')).toBe(true);
      expect(isValidPassword('MyP@ssw0rd')).toBe(true);
    });

    it('should reject weak password', () => {
      expect(isValidPassword('test')).toBe(false); // Too short
      expect(isValidPassword('testtest')).toBe(false); // No uppercase
      expect(isValidPassword('TESTTEST')).toBe(false); // No lowercase
      expect(isValidPassword('TestTest')).toBe(false); // No number
      expect(isValidPassword('TestTest1')).toBe(false); // No special char
    });
  });
});
EOF

# Run tests
npm test
```

---

## Day 7-8: Pre-commit Hooks & Code Quality

### 7.1 Install Husky

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph

npm install --save-dev husky lint-staged

# Initialize husky
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "cd backend && npm run lint-staged"
```

### 7.2 Configure lint-staged

```bash
cd backend

# Add to package.json
npm pkg set 'lint-staged["*.ts"]'='["eslint --fix", "prettier --write"]'

cat >> package.json << 'EOF'
,
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
EOF
```

---

## Day 8-9: API Documentation Setup

### 8.1 Swagger/OpenAPI Setup

```bash
cd backend

npm install --save swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express

cat > swagger.ts << 'EOF'
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'JobGraph API',
      version: '1.0.0',
      description: 'Skills-based job matching platform API',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./services/*/src/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
EOF
```

---

## Day 9-10: Frontend Setup

### 9.1 Initialize Frontend

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph

# Create Vite + React + TypeScript project
npm create vite@latest frontend -- --template react-ts

cd frontend

# Install dependencies
npm install

# Install additional dependencies
npm install react-router-dom @tanstack/react-query axios
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/react-router-dom

# Initialize Tailwind
npx tailwindcss init -p
```

### 9.2 Configure Tailwind

```bash
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
```

### 9.3 Create Basic Frontend Structure

```bash
cd frontend/src

# Create directory structure
mkdir -p components/layout
mkdir -p components/common
mkdir -p pages/auth
mkdir -p pages/dashboard
mkdir -p services/api
mkdir -p hooks
mkdir -p store
mkdir -p types
mkdir -p utils

# Create API client
cat > services/api/client.ts << 'EOF'
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
EOF

# Create .env.example
cat > ../.env.example << 'EOF'
VITE_API_BASE_URL=http://localhost:3000/api/v1
EOF

cp ../.env.example ../.env
```

---

## Day 10: Documentation & Verification

### 10.1 Create Development README

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph

cat > DEV_SETUP.md << 'EOF'
# JobGraph - Development Setup

## Prerequisites

- Node.js 18+ (or Python 3.11+ if using Python backend)
- Docker & Docker Compose
- PostgreSQL client (optional, for direct DB access)
- Git

## Quick Start

### 1. Clone and Install

\`\`\`bash
git clone <repo-url>
cd JobGraph

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
\`\`\`

### 2. Start Docker Services

\`\`\`bash
# From project root
docker-compose up -d

# Verify services are running
docker-compose ps
\`\`\`

### 3. Set Up Database

\`\`\`bash
# Load schema
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql

# Seed data
cd backend
npx ts-node ../scripts/seed-data/seed-skills.ts
npx ts-node ../scripts/seed-data/seed-test-users.ts
\`\`\`

### 4. Configure Environment

\`\`\`bash
# Backend
cd backend
cp .env.example .env
# Edit .env if needed

# Frontend
cd frontend
cp .env.example .env
\`\`\`

### 5. Start Development Servers

\`\`\`bash
# Terminal 1: Backend (when services are ready)
cd backend
npm run dev:auth  # Or other services

# Terminal 2: Frontend
cd frontend
npm run dev
\`\`\`

## Available Commands

### Backend

\`\`\`bash
npm run dev:auth          # Start auth service
npm run dev:profile       # Start profile service
npm run test              # Run tests
npm run lint              # Lint code
npm run format            # Format code with Prettier
\`\`\`

### Frontend

\`\`\`bash
npm run dev               # Start dev server
npm run build             # Build for production
npm run preview           # Preview production build
\`\`\`

### Docker

\`\`\`bash
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose logs -f    # View logs
\`\`\`

## Database Access

### Using Adminer (Web UI)
- Open http://localhost:8080
- Server: postgres
- Username: postgres
- Password: postgres
- Database: jobgraph_dev

### Using psql
\`\`\`bash
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev
\`\`\`

## Test Credentials

- Candidate: candidate@test.com / Test123!
- Employer: employer@test.com / Test123!
- Admin: admin@test.com / Admin123!

## Troubleshooting

### Port conflicts
If ports 3000, 5432, 6379, or 8080 are in use:
- Stop conflicting services
- Or modify ports in docker-compose.yml

### Database connection issues
\`\`\`bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
\`\`\`

### Clear everything and start fresh
\`\`\`bash
docker-compose down -v
docker-compose up -d
# Re-run database setup steps
\`\`\`
EOF
```

### 10.2 Verification Checklist

Create a checklist to verify Phase 0 completion:

```bash
cat > PHASE_0_CHECKLIST.md << 'EOF'
# Phase 0 Completion Checklist

## Repository Structure
- [ ] Backend directory structure created
- [ ] Frontend directory structure created
- [ ] Infrastructure directory created
- [ ] Scripts directory created
- [ ] Documentation files present

## Backend Setup
- [ ] Package.json configured with workspaces
- [ ] TypeScript configuration complete
- [ ] ESLint and Prettier configured
- [ ] Common package builds successfully
- [ ] All service directories initialized

## Database
- [ ] Docker Compose file created
- [ ] PostgreSQL container running
- [ ] Redis container running
- [ ] DATABASE_SCHEMA.sql loaded successfully
- [ ] Can connect to database
- [ ] Seed scripts work (skills, test users)

## Development Tools
- [ ] Environment variables configured (.env files)
- [ ] Git hooks (Husky) installed
- [ ] Pre-commit hooks working
- [ ] Jest configured for testing
- [ ] Sample tests pass

## Common Utilities
- [ ] Database connection module working
- [ ] Redis connection working
- [ ] Password hashing utilities work
- [ ] JWT utilities work
- [ ] Validation helpers work

## Frontend Setup
- [ ] Vite + React + TypeScript initialized
- [ ] TailwindCSS configured
- [ ] API client configured
- [ ] Basic directory structure created
- [ ] Development server starts

## Documentation
- [ ] DEV_SETUP.md created
- [ ] README.md updated
- [ ] EXECUTION_PLAN.md exists
- [ ] CLAUDE.md exists

## Verification Tests

### Test Database Connection
\`\`\`bash
cd backend
npx ts-node -e "import { testDatabaseConnection, testRedisConnection } from './common/src/database'; testDatabaseConnection(); testRedisConnection();"
\`\`\`

### Test Password Hashing
\`\`\`bash
npx ts-node -e "import { hashPassword, comparePassword } from './common/src/utils'; (async () => { const hash = await hashPassword('test'); console.log(await comparePassword('test', hash)); })();"
\`\`\`

### Run Unit Tests
\`\`\`bash
npm test
\`\`\`

### Verify Seed Data
\`\`\`bash
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "SELECT COUNT(*) FROM skills;"
docker exec -it jobgraph-postgres psql -U postgres -d jobgraph_dev -c "SELECT email, role FROM users;"
\`\`\`

## Success Criteria
- [ ] All checklist items completed
- [ ] Docker services running (postgres, redis)
- [ ] Database has schema and seed data
- [ ] Backend common package builds
- [ ] Tests pass
- [ ] Frontend dev server starts
- [ ] Can commit code (pre-commit hooks work)

## Next Steps
Once Phase 0 is complete:
1. Review EXECUTION_PLAN.md Phase 1
2. Start with Auth Service implementation (Phase 1.1)
3. Create first API endpoint
EOF
```

---

## Summary of Phase 0 Deliverables

### Created Files & Directories:
```
JobGraph/
├── backend/
│   ├── package.json (workspace config)
│   ├── tsconfig.json
│   ├── .eslintrc.json
│   ├── .prettierrc
│   ├── .env.example
│   ├── .env
│   ├── jest.config.js
│   ├── swagger.ts
│   ├── common/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── database/index.ts
│   │       ├── types/index.ts
│   │       └── utils/index.ts
│   ├── services/
│   │   ├── auth-service/
│   │   ├── profile-service/
│   │   ├── interview-service/
│   │   ├── job-service/
│   │   ├── matching-service/
│   │   └── notification-service/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/api/client.ts
│   │   └── ...
│   ├── .env.example
│   └── .env
├── infrastructure/
├── scripts/
│   └── seed-data/
│       ├── seed-skills.ts
│       └── seed-test-users.ts
├── docker-compose.yml
├── DEV_SETUP.md
├── PHASE_0_CHECKLIST.md
└── (existing files: README.md, SYSTEM_DESIGN.md, etc.)
```

### Services Running:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Adminer (port 8080)

### Database Contains:
- Complete schema (all tables)
- ~35 seeded skills
- 3 test users (candidate, employer, admin)

### Tools Configured:
- TypeScript compilation
- ESLint for linting
- Prettier for formatting
- Jest for testing
- Husky for git hooks
- Swagger for API docs

---

## Quick Start Commands

```bash
# Start everything
docker-compose up -d
cd backend && npm install
cd ../frontend && npm install

# Load database
docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql
npx ts-node scripts/seed-data/seed-skills.ts
npx ts-node scripts/seed-data/seed-test-users.ts

# Verify
docker-compose ps
npm test
```

**Phase 0 Complete! Ready for Phase 1 (Auth Service Implementation)**
