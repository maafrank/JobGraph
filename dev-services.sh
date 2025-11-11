#!/bin/bash

# JobGraph Development Services Manager
# Usage: ./dev-services.sh
# Press Ctrl+C to stop all services

# Get the root directory FIRST before any cd commands
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Service ports
PORTS=(3000 3001 3002 3003 3004 5173)
SERVICE_NAMES=("Auth" "Profile" "Job" "Skills" "Matching" "Frontend")
PIDS=()

# Cleanup function - called on Ctrl+C
cleanup() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Shutting down all services...${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Kill all processes we started
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${BLUE}Stopping process $pid${NC}"
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    # Wait a moment
    sleep 2

    # Force kill any remaining processes on our ports
    for port in "${PORTS[@]}"; do
        pids=$(lsof -ti:$port 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo -e "${BLUE}Force stopping service on port $port${NC}"
            echo "$pids" | xargs kill -9 2>/dev/null || true
        fi
    done

    echo -e "${GREEN}✓ All services stopped${NC}"
    echo -e "${CYAN}Goodbye!${NC}"
    exit 0
}

# Set up trap to catch Ctrl+C
trap cleanup SIGINT SIGTERM

# Function to check if a port is in use
check_port() {
    lsof -ti:$1 > /dev/null 2>&1
    return $?
}

# Function to get PID for a port
get_pid() {
    lsof -ti:$1 2>/dev/null
}

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   JobGraph Development Environment${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if Docker is running
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if database containers are running
if ! docker ps | grep -q jobgraph-postgres; then
    echo -e "${YELLOW}Starting Docker containers...${NC}"
    (cd "$ROOT_DIR" && docker-compose up -d)
    sleep 3
    echo -e "${GREEN}✓ Docker containers started${NC}"
else
    echo -e "${GREEN}✓ Docker containers are running${NC}"
fi

# Stop any existing services on our ports
echo ""
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
for port in "${PORTS[@]}"; do
    if check_port $port; then
        pid=$(get_pid $port)
        echo -e "${BLUE}Stopping existing process on port $port${NC}"
        kill -9 $pid 2>/dev/null || true
    fi
done
sleep 2
echo -e "${GREEN}✓ Ports cleaned${NC}"

# Build common package first
echo ""
echo -e "${YELLOW}Building common package...${NC}"
(cd "$ROOT_DIR/backend/common" && npm run build > /dev/null 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Common package built${NC}"
else
    echo -e "${RED}✗ Failed to build common package${NC}"
    exit 1
fi

# Start services
echo ""
echo -e "${YELLOW}Starting services...${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Start Auth Service
echo -e "${BLUE}Starting Auth Service (port 3000)...${NC}"
(cd "$ROOT_DIR/backend" && npm run dev:auth > /tmp/jobgraph-auth.log 2>&1) &
PIDS+=($!)

# Start Profile Service
echo -e "${BLUE}Starting Profile Service (port 3001)...${NC}"
(cd "$ROOT_DIR/backend" && npm run dev:profile > /tmp/jobgraph-profile.log 2>&1) &
PIDS+=($!)

# Start Job Service
echo -e "${BLUE}Starting Job Service (port 3002)...${NC}"
(cd "$ROOT_DIR/backend" && npm run dev:job > /tmp/jobgraph-job.log 2>&1) &
PIDS+=($!)

# Start Skills Service
echo -e "${BLUE}Starting Skills Service (port 3003)...${NC}"
(cd "$ROOT_DIR/backend" && npm run dev:skill > /tmp/jobgraph-skills.log 2>&1) &
PIDS+=($!)

# Start Matching Service
echo -e "${BLUE}Starting Matching Service (port 3004)...${NC}"
(cd "$ROOT_DIR/backend" && npm run dev:matching > /tmp/jobgraph-matching.log 2>&1) &
PIDS+=($!)

# Start Frontend
echo -e "${BLUE}Starting Frontend (port 5173)...${NC}"
(cd "$ROOT_DIR/frontend" && npm run dev > /tmp/jobgraph-frontend.log 2>&1) &
PIDS+=($!)

# Wait for services to start
echo ""
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 8

# Check status
echo ""
echo -e "${YELLOW}Service Status:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

all_running=true
for i in "${!PORTS[@]}"; do
    port=${PORTS[$i]}
    name=${SERVICE_NAMES[$i]}

    if check_port $port; then
        pid=$(get_pid $port)
        echo -e "${GREEN}✓${NC} $name (port $port) - Running"
    else
        echo -e "${RED}✗${NC} $name (port $port) - Failed to start"
        all_running=false
    fi
done

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if $all_running; then
    echo -e "${GREEN}✓ All services are running!${NC}"
    echo ""
    echo -e "${CYAN}Access your application:${NC}"
    echo -e "  ${BLUE}Frontend:${NC}     http://localhost:5173"
    echo -e "  ${BLUE}Auth API:${NC}     http://localhost:3000/api/v1"
    echo -e "  ${BLUE}Profile API:${NC}  http://localhost:3001/api/v1"
    echo -e "  ${BLUE}Job API:${NC}      http://localhost:3002/api/v1"
    echo -e "  ${BLUE}Skills API:${NC}   http://localhost:3003/api/v1"
    echo -e "  ${BLUE}Matching API:${NC} http://localhost:3004/api/v1"
    echo ""
    echo -e "${YELLOW}Logs available at:${NC} /tmp/jobgraph-*.log"
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Monitoring services... (Ctrl+C to exit)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${RED}✗ Some services failed to start${NC}"
    echo -e "${YELLOW}Check logs at:${NC} /tmp/jobgraph-*.log"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo -e "  - Ports may be in use by another process"
    echo -e "  - Database may not be running"
    echo -e "  - Dependencies may not be installed"
    echo ""
    cleanup
fi

# Monitor processes - wait for any to exit or for Ctrl+C
while true; do
    # Check if any of our processes died
    for pid in "${PIDS[@]}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo ""
            echo -e "${RED}✗ A service has stopped unexpectedly (PID: $pid)${NC}"
            echo -e "${YELLOW}Check logs at:${NC} /tmp/jobgraph-*.log"
            cleanup
        fi
    done

    sleep 5
done
