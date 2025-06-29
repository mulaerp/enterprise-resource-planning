# MulaERP Makefile

.PHONY: help setup build start stop restart logs clean backup deploy test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}\' $(MAKEFILE_LIST)

setup: ## Initial setup of the project
	@chmod +x scripts/*.sh
	@./scripts/setup.sh

build: ## Build all Docker images
	docker-compose build

start: ## Start all services
	docker-compose up -d

stop: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs from all services
	docker-compose logs -f

clean: ## Clean up containers, images, and volumes
	docker-compose down -v --rmi all
	docker system prune -f

backup: ## Create a backup of data
	@./scripts/backup.sh

deploy: ## Deploy to production
	@./scripts/deploy.sh

test: ## Run tests
	docker-compose exec backend ./mvnw test
	docker-compose exec frontend npm test

dev: ## Start in development mode
	docker-compose -f docker-compose.yml -f docker-compose.override.yml up

prod: ## Start in production mode
	docker-compose -f docker-compose.yml up -d

health: ## Check service health
	@echo "Checking service health..."
	@curl -f http://localhost/health && echo "✅ Services are healthy" || echo "❌ Services are unhealthy"

monitor: ## Monitor resource usage
	docker stats

shell-backend: ## Open shell in backend container
	docker-compose exec backend bash

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend sh

db-shell: ## Open DynamoDB shell
	docker-compose exec dynamodb-local aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-1

cache-shell: ## Open Valkey shell
	docker-compose exec valkey valkey-cli