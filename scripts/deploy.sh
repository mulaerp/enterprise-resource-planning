#!/bin/bash

# MulaERP Production Deployment Script
set -e

echo "Deploying MulaERP to production..."

# Pull latest images
docker-compose pull

# Build new images
docker-compose build --no-cache

# Stop services gracefully
docker-compose down --timeout 30

# Start services
docker-compose up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# Health check
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ MulaERP deployed successfully!"
    echo "Frontend: http://localhost"
    echo "API: http://localhost/api"
    echo "Health: http://localhost/health"
else
    echo "❌ Deployment failed - health check failed"
    docker-compose logs
    exit 1
fi

# Clean up old images
docker image prune -f

echo "Deployment complete!"