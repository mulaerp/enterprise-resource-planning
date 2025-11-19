#!/bin/bash

# Mula ERP E2E Test Runner
# This script runs Playwright E2E tests for the frontend

set -e

echo "🧪 Mula ERP E2E Test Runner"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backend is running
echo "📡 Checking if backend is running..."
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo ""
    echo "Please start the backend first:"
    echo "  docker-compose up backend postgres valkey"
    echo "  OR"
    echo "  cd backend && mvn spring-boot:run"
    exit 1
fi

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Playwright browsers are installed
if [ ! -d "node_modules/@playwright" ]; then
    echo ""
    echo "🌐 Installing Playwright browsers..."
    npx playwright install
fi

echo ""
echo "🎭 Running Playwright tests..."
echo ""

# Parse command line arguments
MODE=${1:-"run"}

case $MODE in
    "ui")
        echo "Running tests in UI mode..."
        npm run test:e2e:ui
        ;;
    "headed")
        echo "Running tests in headed mode..."
        npm run test:e2e:headed
        ;;
    "debug")
        echo "Running tests in debug mode..."
        npm run test:e2e:debug
        ;;
    "chromium")
        echo "Running tests in Chromium only..."
        npx playwright test --project=chromium
        ;;
    "firefox")
        echo "Running tests in Firefox only..."
        npx playwright test --project=firefox
        ;;
    "webkit")
        echo "Running tests in WebKit only..."
        npx playwright test --project=webkit
        ;;
    "report")
        echo "Opening test report..."
        npx playwright show-report
        ;;
    *)
        echo "Running all tests..."
        npm run test:e2e
        ;;
esac

echo ""
echo -e "${GREEN}✓ Tests completed${NC}"
echo ""
echo "To view the report, run:"
echo "  npx playwright show-report"
