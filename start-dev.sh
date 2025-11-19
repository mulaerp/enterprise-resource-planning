#!/bin/bash

# Development Start Script
# Starts all services for local development

set -e

echo "=========================================="
echo "Mula ERP - Development Environment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start infrastructure services
echo -e "${BLUE}Starting infrastructure services...${NC}"
docker-compose up -d postgres valkey

echo "Waiting for services to be ready..."
sleep 5

echo -e "${GREEN}✓ PostgreSQL and Valkey are running${NC}"
echo ""

# Check if backend should be started
echo -e "${YELLOW}Backend Setup:${NC}"
echo "To start the backend, run in a new terminal:"
echo "  cd backend && mvn spring-boot:run"
echo ""

# Check if frontend should be started
echo -e "${YELLOW}Frontend Setup:${NC}"
echo "To start the frontend, run in a new terminal:"
echo "  cd frontend && npm install && npm run dev"
echo ""

echo "=========================================="
echo "Services Status"
echo "=========================================="
docker-compose ps
echo ""

echo -e "${GREEN}Infrastructure is ready!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start backend in terminal 1"
echo "  2. Start frontend in terminal 2"
echo "  3. Open http://localhost:5173"
echo "  4. Login with admin@mulaerp.com / admin123"
echo ""
