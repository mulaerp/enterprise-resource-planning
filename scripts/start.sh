#!/bin/bash

echo "🚀 Starting Mula ERP System..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
fi

echo "📦 Building and starting services..."
echo ""

docker-compose up --build

echo ""
echo "✅ Services started!"
echo ""
echo "Access the application:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8080"
echo "  Health:   http://localhost:8080/api/v1/health"
echo ""
echo "Login credentials:"
echo "  Email:    admin@mulaerp.com"
echo "  Password: admin123"
echo ""
