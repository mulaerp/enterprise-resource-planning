#!/bin/bash

# Mula ERP - Dockerized backend integration test runner (WP8+9)
#
# Runs the backend integration test suite (backend/src/test/java/com/mulaerp/it/**) against a
# REAL, throwaway Postgres + Valkey - never the live dev stack (compose project
# `enterprise-resource-planning`) and never its postgres data volume.
#
# What it does:
#   1. Creates a dedicated Docker network (mulaerp-test-net) and starts postgres:16-alpine +
#      valkey/valkey:7.2-alpine on it, with container names distinct from the dev stack
#      (mulaerp-test-postgres / mulaerp-test-valkey) and NO host port bindings at all - so it
#      cannot collide with a dev stack already listening on 5432/6379.
#   2. Waits for both to report healthy.
#   3. Runs `mvn test` inside a maven:3.9-eclipse-temurin-21 container (no local Java/Maven on
#      this machine - see repo CLAUDE.md), attached to the same network, with
#      DATABASE_HOST/PORT/NAME/USER/PASSWORD and REDIS_HOST/REDIS_PORT pointed at the throwaway
#      containers, backend/ bind-mounted read-write, and a named ~/.m2 cache volume
#      (mulaerp-m2-cache) so repeated runs don't re-download the internet.
#   4. ALWAYS tears the test containers/network down on exit (trap on EXIT), success or failure.
#      The mulaerp-m2-cache volume is intentionally kept (it's a build cache, not test state).
#
# Usage:
#   ./scripts/run-backend-tests.sh
#
# Env vars:
#   KEEP_CONTAINERS=1   Skip teardown of the test postgres/valkey/network (useful for debugging a
#                        failure with `docker exec -it mulaerp-test-postgres psql ...`). You are
#                        responsible for cleaning up manually afterwards in this case.

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

NETWORK_NAME="mulaerp-test-net"
POSTGRES_NAME="mulaerp-test-postgres"
VALKEY_NAME="mulaerp-test-valkey"
MAVEN_CONTAINER_NAME="mulaerp-test-maven"
M2_VOLUME="mulaerp-m2-cache"

TEST_DB_NAME="mulaerp_test"
TEST_DB_USER="mulaerp"
TEST_DB_PASSWORD="mulaerp_test"

MAVEN_IMAGE="maven:3.9-eclipse-temurin-21"

echo "=========================================="
echo "Mula ERP - Backend Integration Test Runner"
echo "=========================================="
echo ""

cleanup() {
    local exit_code=$?
    if [ "${KEEP_CONTAINERS:-0}" = "1" ]; then
        echo -e "${YELLOW}KEEP_CONTAINERS=1 set - leaving ${POSTGRES_NAME}/${VALKEY_NAME}/${NETWORK_NAME} running.${NC}"
        echo -e "${YELLOW}Clean up manually with: docker rm -f ${POSTGRES_NAME} ${VALKEY_NAME} && docker network rm ${NETWORK_NAME}${NC}"
    else
        echo ""
        echo -e "${BLUE}Tearing down test containers/network (never touches the dev stack)...${NC}"
        docker rm -f "${MAVEN_CONTAINER_NAME}" >/dev/null 2>&1 || true
        docker rm -f "${POSTGRES_NAME}" >/dev/null 2>&1 || true
        docker rm -f "${VALKEY_NAME}" >/dev/null 2>&1 || true
        docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true
        echo -e "${GREEN}✓ Test containers/network removed (mulaerp-m2-cache volume kept as a build cache).${NC}"
    fi
    exit "$exit_code"
}
trap cleanup EXIT

# ---- Defensive pre-clean: in case a previous run was killed before its trap fired -------------
docker rm -f "${MAVEN_CONTAINER_NAME}" "${POSTGRES_NAME}" "${VALKEY_NAME}" >/dev/null 2>&1 || true
docker network rm "${NETWORK_NAME}" >/dev/null 2>&1 || true

echo -e "${BLUE}Creating dedicated test network (${NETWORK_NAME})...${NC}"
docker network create "${NETWORK_NAME}" >/dev/null

echo -e "${BLUE}Starting throwaway postgres (${POSTGRES_NAME}) - no host port bound...${NC}"
docker run -d \
    --name "${POSTGRES_NAME}" \
    --network "${NETWORK_NAME}" \
    -e POSTGRES_DB="${TEST_DB_NAME}" \
    -e POSTGRES_USER="${TEST_DB_USER}" \
    -e POSTGRES_PASSWORD="${TEST_DB_PASSWORD}" \
    -e POSTGRES_INITDB_ARGS="--encoding=UTF-8 --lc-collate=C --lc-ctype=C" \
    postgres:16-alpine >/dev/null

echo -e "${BLUE}Starting throwaway valkey (${VALKEY_NAME}) - no host port bound, no auth (internal-network-only)...${NC}"
docker run -d \
    --name "${VALKEY_NAME}" \
    --network "${NETWORK_NAME}" \
    valkey/valkey:7.2-alpine >/dev/null

wait_for_postgres() {
    local retries=60
    until docker exec "${POSTGRES_NAME}" pg_isready -U "${TEST_DB_USER}" -d "${TEST_DB_NAME}" >/dev/null 2>&1; do
        retries=$((retries - 1))
        if [ "$retries" -le 0 ]; then
            echo -e "${RED}✗ Timed out waiting for ${POSTGRES_NAME} to become ready${NC}"
            docker logs "${POSTGRES_NAME}" || true
            exit 1
        fi
        sleep 2
    done
    echo -e "${GREEN}✓ ${POSTGRES_NAME} is ready${NC}"
}

wait_for_valkey() {
    local retries=30
    until docker exec "${VALKEY_NAME}" valkey-cli ping 2>/dev/null | grep -q PONG; do
        retries=$((retries - 1))
        if [ "$retries" -le 0 ]; then
            echo -e "${RED}✗ Timed out waiting for ${VALKEY_NAME} to become ready${NC}"
            docker logs "${VALKEY_NAME}" || true
            exit 1
        fi
        sleep 2
    done
    echo -e "${GREEN}✓ ${VALKEY_NAME} is ready${NC}"
}

echo -e "${BLUE}Waiting for test postgres/valkey to become healthy...${NC}"
wait_for_postgres
wait_for_valkey

echo ""
echo -e "${BLUE}Ensuring Maven dependency cache volume (${M2_VOLUME}) exists...${NC}"
docker volume create "${M2_VOLUME}" >/dev/null

echo ""
echo -e "${BLUE}Running \`mvn test\` in ${MAVEN_IMAGE} (backend/ mounted, ${M2_VOLUME} cache attached)...${NC}"
echo ""

set +e
docker run --rm \
    --name "${MAVEN_CONTAINER_NAME}" \
    --network "${NETWORK_NAME}" \
    -v "${BACKEND_DIR}:/app" \
    -v "${M2_VOLUME}:/root/.m2" \
    -w /app \
    -e SPRING_PROFILES_ACTIVE=test \
    -e DATABASE_HOST="${POSTGRES_NAME}" \
    -e DATABASE_PORT=5432 \
    -e DATABASE_NAME="${TEST_DB_NAME}" \
    -e DATABASE_USER="${TEST_DB_USER}" \
    -e DATABASE_PASSWORD="${TEST_DB_PASSWORD}" \
    -e REDIS_HOST="${VALKEY_NAME}" \
    -e REDIS_PORT=6379 \
    -e REDIS_PASSWORD= \
    -e JWT_SECRET="test-only-jwt-secret-min-32-characters-long" \
    "${MAVEN_IMAGE}" \
    mvn -B -ntp test
EXIT_CODE=$?
set -e

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}✓ Backend integration tests passed${NC}"
else
    echo -e "${RED}✗ Backend integration tests failed (exit code ${EXIT_CODE})${NC}"
fi

exit "$EXIT_CODE"
