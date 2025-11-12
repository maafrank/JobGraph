#!/bin/bash

# E2E Test Suite Runner
# Runs all end-to-end tests and generates a summary report

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}   JobGraph E2E Test Suite Runner${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if services are running
SERVICES_OK=true
for port in 3000 3001 3002 3003 3004; do
    if ! lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${RED}✗ Service not running on port $port${NC}"
        SERVICES_OK=false
    fi
done

if [ "$SERVICES_OK" = false ]; then
    echo -e "${RED}Error: Not all services are running${NC}"
    echo -e "${YELLOW}Please start services first:${NC}"
    echo "  ./dev-services.sh"
    exit 1
fi

echo -e "${GREEN}✓ All services running${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Log file for detailed output
LOG_DIR="/tmp/jobgraph-e2e-logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUMMARY_LOG="$LOG_DIR/e2e-summary-$TIMESTAMP.log"

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Test Suite 1: Candidate Flow${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Run candidate flow tests
CANDIDATE_LOG="$LOG_DIR/candidate-$TIMESTAMP.log"
if bash "$SCRIPT_DIR/test-candidate-flow.sh" > "$CANDIDATE_LOG" 2>&1; then
    CANDIDATE_PASSED=$(grep "Passed:" "$CANDIDATE_LOG" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $2}' || echo "0")
    CANDIDATE_FAILED=$(grep "Failed:" "$CANDIDATE_LOG" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $2}' || echo "0")
    CANDIDATE_TOTAL=$((CANDIDATE_PASSED + CANDIDATE_FAILED))

    echo -e "${GREEN}✓ Candidate Flow Tests Complete${NC}"
    echo -e "  Passed: ${GREEN}$CANDIDATE_PASSED${NC}"
    echo -e "  Failed: ${RED}$CANDIDATE_FAILED${NC}"
    echo -e "  Total:  $CANDIDATE_TOTAL"

    TOTAL_TESTS=$((TOTAL_TESTS + CANDIDATE_TOTAL))
    TOTAL_PASSED=$((TOTAL_PASSED + CANDIDATE_PASSED))
    TOTAL_FAILED=$((TOTAL_FAILED + CANDIDATE_FAILED))
else
    echo -e "${RED}✗ Candidate Flow Tests Failed${NC}"
    echo -e "${YELLOW}Check log: $CANDIDATE_LOG${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
fi

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Test Suite 2: Employer Flow${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Run employer flow tests
EMPLOYER_LOG="$LOG_DIR/employer-$TIMESTAMP.log"
if bash "$SCRIPT_DIR/test-employer-flow.sh" > "$EMPLOYER_LOG" 2>&1; then
    EMPLOYER_PASSED=$(grep "Passed:" "$EMPLOYER_LOG" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $2}' || echo "0")
    EMPLOYER_FAILED=$(grep "Failed:" "$EMPLOYER_LOG" | tail -1 | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $2}' || echo "0")
    EMPLOYER_TOTAL=$((EMPLOYER_PASSED + EMPLOYER_FAILED))

    echo -e "${GREEN}✓ Employer Flow Tests Complete${NC}"
    echo -e "  Passed: ${GREEN}$EMPLOYER_PASSED${NC}"
    echo -e "  Failed: ${RED}$EMPLOYER_FAILED${NC}"
    echo -e "  Total:  $EMPLOYER_TOTAL"

    TOTAL_TESTS=$((TOTAL_TESTS + EMPLOYER_TOTAL))
    TOTAL_PASSED=$((TOTAL_PASSED + EMPLOYER_PASSED))
    TOTAL_FAILED=$((TOTAL_FAILED + EMPLOYER_FAILED))
else
    echo -e "${RED}✗ Employer Flow Tests Failed${NC}"
    echo -e "${YELLOW}Check log: $EMPLOYER_LOG${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
fi

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}Final Summary${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

if [ $TOTAL_TESTS -eq 0 ]; then
    PASS_RATE="0.0"
else
    PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_PASSED/$TOTAL_TESTS)*100}")
fi

echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$TOTAL_PASSED${NC}"
echo -e "Failed:       ${RED}$TOTAL_FAILED${NC}"
echo -e "Pass Rate:    $PASS_RATE%"
echo ""

# Write summary to log file
{
    echo "JobGraph E2E Test Suite Summary"
    echo "Date: $(date)"
    echo "================================"
    echo ""
    echo "Candidate Flow: $CANDIDATE_PASSED/$CANDIDATE_TOTAL passed"
    echo "Employer Flow:  $EMPLOYER_PASSED/$EMPLOYER_TOTAL passed"
    echo ""
    echo "Total: $TOTAL_PASSED/$TOTAL_TESTS passed ($PASS_RATE%)"
} > "$SUMMARY_LOG"

echo -e "${BLUE}Detailed logs saved to:${NC}"
echo -e "  Summary:   $SUMMARY_LOG"
echo -e "  Candidate: $CANDIDATE_LOG"
echo -e "  Employer:  $EMPLOYER_LOG"
echo ""

# Exit with appropriate code
if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
