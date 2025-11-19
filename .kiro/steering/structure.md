# Project Structure

## Repository Organization

This is a **monorepo** that orchestrates multiple services via Git submodules. The root repository contains Docker Compose configuration and shared infrastructure, while application code lives in separate submodule repositories.

## Root Directory Layout

```
.
├── mula-erp-frontend/       # React frontend (Git submodule)
├── mula-erp-backend/        # Java Spring Boot backend (Git submodule)
├── mula-erp-middleware/     # Node.js middleware (Git submodule)
├── nginx/                   # Nginx reverse proxy configuration
│   └── nginx.conf          # Main Nginx config file
├── postgres_data/           # PostgreSQL data directory (mounted volume)
├── postgres_backups/        # Automated database backups
├── valkey_data/            # Valkey/Redis cache data (mounted volume)
├── logs/                   # Application logs (created at runtime)
│   ├── backend/           # Backend service logs
│   ├── batch/             # Batch job logs
│   └── nginx/             # Nginx access/error logs
├── config/                 # Backend configuration files (mounted read-only)
├── init-scripts/           # Database initialization scripts
├── backup-scripts/         # Database backup scripts
├── compose.yaml            # Docker Compose orchestration
├── .env                    # Environment variables (not in git)
├── .env.example            # Environment template
├── .gitmodules             # Git submodule configuration
└── README.md               # Project documentation
```

## Service Architecture

### Frontend Service
- **Location**: `mula-erp-frontend/` submodule
- **Type**: React SPA with Vite
- **Build Output**: `dist/` directory mounted to Nginx
- **Dockerfile**: `Dockerfile.frontend.dev`

### Backend Service
- **Location**: `mula-erp-backend/` submodule
- **Type**: Java Spring Boot REST API
- **Dockerfiles**: 
  - `Dockerfile.backend` - Main API service
  - `Dockerfile.batch` - Batch job runner
- **Logs**: Mounted to `./logs/backend/`

### Middleware Service
- **Location**: `mula-erp-middleware/` submodule
- **Type**: Node.js integration service

### Infrastructure Services

**PostgreSQL Database**
- Data persisted in `./postgres_data/`
- Initialization scripts in `./init-scripts/`
- Automated backups to `./postgres_backups/`
- Backup retention: 7 days

**Valkey Cache**
- Data persisted in `./valkey_data/`
- AOF (Append-Only File) persistence enabled
- Memory limit: 512MB with LRU eviction

**Nginx Proxy**
- Configuration: `./nginx/nginx.conf`
- SSL certificates: `./nginx/ssl/` (for production)
- Serves frontend static files from `./mula-erp-frontend/dist/`
- Proxies `/api/*` requests to backend

**Batch Runner**
- Runs scheduled jobs via cron
- Uses same backend codebase with `batch` profile
- Logs to `./logs/batch/`

**DB Backup Service**
- Automated daily backups at 2 AM (configurable)
- Saves to `./postgres_backups/`
- Auto-cleanup of backups older than 7 days

## Working with Submodules

### Important Notes
- Application code is NOT in the root repository
- Each service (frontend, backend, middleware) is a separate Git repository
- Changes to services must be committed in their respective submodule directories
- Root repository only tracks submodule commit references

### Submodule Workflow
```bash
# Update all submodules to latest
git submodule update --remote

# Work in a specific submodule
cd mula-erp-backend
git checkout main
# Make changes, commit, push

# Update root repo to reference new submodule commit
cd ..
git add mula-erp-backend
git commit -m "Update backend submodule"
```

## Data Persistence

**Persistent Volumes** (not in Git):
- `postgres_data/` - Database files
- `valkey_data/` - Cache data
- `postgres_backups/` - Database backups
- `logs/` - Application logs

**Configuration Files** (in Git):
- `compose.yaml` - Service definitions
- `nginx/nginx.conf` - Proxy configuration
- `.env.example` - Environment template

## Network Architecture

All services communicate via `mulaerp-network` Docker bridge network:
- Services reference each other by service name (e.g., `postgres`, `backend`, `valkey`)
- External access via published ports
- Nginx acts as reverse proxy for external HTTP traffic

## Development vs Production

The current setup uses development Dockerfiles (`Dockerfile.frontend.dev`). For production:
- Use production-optimized Dockerfiles
- Configure SSL certificates in `./nginx/ssl/`
- Set strong passwords and secrets in `.env`
- Consider using Docker secrets or external secret management
- Review and harden `nginx.conf` security settings
