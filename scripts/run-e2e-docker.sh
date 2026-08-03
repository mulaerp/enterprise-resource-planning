#!/bin/bash

# Mula ERP Dockerized E2E Test Runner
#
# Brings up the full Docker stack (frontend, backend, postgres, valkey) and
# runs the Playwright test suite inside a Linux container
# (mcr.microsoft.com/playwright) against it, so results don't depend on the
# host's OS/browser versions.
#
# Usage:
#   ./scripts/run-e2e-docker.sh
#
# Env vars:
#   KEEP_STACK=1   Skip removing the playwright container after the run
#                  (useful for `docker compose logs playwright` / debugging).
#                  The frontend/backend/postgres/valkey stack is always left
#                  running either way — this script never tears it down.

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILES=(-f compose.yaml -f docker-compose.e2e.yml)

echo "=========================================="
echo "Mula ERP - Dockerized E2E Test Runner"
echo "=========================================="
echo ""

echo -e "${BLUE}Starting stack (frontend, backend, postgres, valkey)...${NC}"
docker compose "${COMPOSE_FILES[@]}" up -d frontend backend postgres valkey

echo ""
echo -e "${BLUE}Waiting for backend and frontend to become reachable...${NC}"

wait_for() {
    local url="$1"
    local name="$2"
    local retries=60

    until curl -sf "$url" > /dev/null 2>&1; do
        retries=$((retries - 1))
        if [ "$retries" -le 0 ]; then
            echo -e "${RED}✗ Timed out waiting for ${name} (${url})${NC}"
            exit 1
        fi
        sleep 2
    done
    echo -e "${GREEN}✓ ${name} is up${NC}"
}

wait_for "http://localhost:8080/actuator/health" "backend"
wait_for "http://localhost:5173" "frontend"

echo ""
echo -e "${BLUE}Running Playwright tests in Docker...${NC}"
echo ""

RUN_ARGS=(run)
if [ "${KEEP_STACK:-0}" != "1" ]; then
    RUN_ARGS+=(--rm)
fi
RUN_ARGS+=(playwright)

set +e
docker compose "${COMPOSE_FILES[@]}" "${RUN_ARGS[@]}"
EXIT_CODE=$?
set -e

echo ""
if [ "${KEEP_STACK:-0}" = "1" ]; then
    echo -e "${YELLOW}KEEP_STACK=1 set — playwright container left in place; stack still running.${NC}"
else
    echo -e "${BLUE}Playwright container removed (--rm); stack left running.${NC}"
fi

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}✓ E2E tests passed${NC}"
else
    echo -e "${RED}✗ E2E tests failed (exit code ${EXIT_CODE})${NC}"
fi

exit "$EXIT_CODE"
