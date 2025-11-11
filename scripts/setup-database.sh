#!/bin/bash

# JobGraph Database Setup Script
# This script sets up the database and seeds initial data

set -e

echo "🚀 JobGraph Database Setup"
echo "=========================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running"
  echo "Please start Docker Desktop and try again"
  exit 1
fi

echo "✓ Docker is running"
echo ""

# Check if PostgreSQL container is running
if ! docker ps | grep -q jobgraph-postgres; then
  echo "Starting Docker services..."
  docker-compose up -d
  echo "Waiting for PostgreSQL to be ready..."
  sleep 10
else
  echo "✓ Docker services are already running"
fi

echo ""

# Load database schema
echo "Loading database schema..."
if [ -f "DATABASE_SCHEMA.sql" ]; then
  docker exec -i jobgraph-postgres psql -U postgres -d jobgraph_dev < DATABASE_SCHEMA.sql
  echo "✓ Database schema loaded"
else
  echo "❌ Error: DATABASE_SCHEMA.sql not found"
  exit 1
fi

echo ""

# Seed skills
echo "Seeding skills data..."
cd backend
npx ts-node ../scripts/seed-data/seed-skills.ts
echo "✓ Skills seeded"

echo ""

# Seed test users
echo "Seeding test users..."
npx ts-node ../scripts/seed-data/seed-test-users.ts
echo "✓ Test users seeded"

echo ""
echo "=========================="
echo "✅ Database setup complete!"
echo "=========================="
echo ""
echo "You can now:"
echo "  - Access Adminer at http://localhost:8080"
echo "  - Run tests: cd backend && npm test"
echo "  - Start services (Phase 1): cd backend && npm run dev:auth"
echo ""
echo "Test credentials:"
echo "  Candidate: candidate@test.com / Test123!"
echo "  Employer: employer@test.com / Test123!"
echo "  Admin: admin@test.com / Admin123!"
