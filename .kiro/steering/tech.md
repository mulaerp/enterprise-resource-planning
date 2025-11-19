# Technology Stack

## Build System & Orchestration

- **Docker Compose**: Primary orchestration tool for all services
- **Git Submodules**: Component repositories are managed as submodules

## Frontend Stack

- **Framework**: React with Vite build tool
- **Port**: 5172 (dev), 3000 (standalone), 80 (via Nginx)
- **Environment**: Vite environment variables (VITE_*)

## Backend Stack

- **Framework**: Java Spring Boot
- **Port**: 8080
- **Database Driver**: PostgreSQL JDBC driver
- **Profiles**: `production`, `batch` (for scheduled jobs)

## Middleware Stack

- **Runtime**: Node.js
- **Purpose**: Integration services and auxiliary processing

## Infrastructure

- **Database**: PostgreSQL 16 (Alpine)
- **Cache**: Valkey 7.2 (Redis fork, Alpine)
- **Reverse Proxy**: Nginx (Alpine)
- **Container Platform**: Docker with bridge networking

## Security & Authentication

- **JWT**: Token-based authentication
- **Encryption**: Custom encryption key for sensitive data
- **CAS Integration**: External Central Authentication Service at `app.penril.net`

## Common Commands

### Initial Setup
```bash
# Initialize and update submodules
git submodule update --init --recursive
```

### Development
```bash
# Build and start all services
docker-compose up --build

# Start services without rebuilding
docker-compose up

# Stop all services
docker-compose down

# View logs for specific service
docker-compose logs -f [service-name]
# Example: docker-compose logs -f backend
```

### Database Operations
```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U mulaerp -d mulaerp

# Manual backup
docker-compose exec postgres pg_dump -U mulaerp mulaerp > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U mulaerp -d mulaerp < backup.sql
```

### Cache Operations
```bash
# Access Valkey CLI
docker-compose exec valkey valkey-cli -a [REDIS_PASSWORD]

# Flush cache
docker-compose exec valkey valkey-cli -a [REDIS_PASSWORD] FLUSHALL
```

### Service Management
```bash
# Restart specific service
docker-compose restart [service-name]

# Rebuild specific service
docker-compose up --build [service-name]

# View service status
docker-compose ps
```

## Environment Configuration

Environment variables are managed via `.env` file (see `.env.example` for template). Key variables:

- `DATABASE_PASSWORD`: PostgreSQL password
- `REDIS_PASSWORD`: Valkey/Redis password
- `JWT_SECRET`: JWT signing key (min 32 chars)
- `ENCRYPTION_KEY`: Data encryption key (32 chars)
- `CAS_ADMIN_TOKEN`: CAS integration token
- `BATCH_SCHEDULE`: Cron expression for batch jobs (default: `0 2 * * *`)

## Network Configuration

All services communicate via Docker bridge network `mulaerp-network` (subnet: 172.20.0.0/16).

API routing through Nginx:
- `/api/*` → proxied to `backend:8080`
- `/*` → served from frontend static files
