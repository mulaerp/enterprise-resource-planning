# Troubleshooting Guide

## Current Status

✅ **PostgreSQL**: Running and healthy on port 5432
✅ **Valkey (Redis)**: Running and healthy on port 6379
⏳ **Backend**: Build in progress (Maven dependencies download takes time)
⏳ **Frontend**: Waiting for backend

## Issue: Docker Build Taking Too Long

The initial Docker build for the backend can take 5-10 minutes because:
1. Maven needs to download all dependencies (~200MB)
2. Spring Boot compilation takes time
3. Multi-stage Docker build

### Solution 1: Wait for the Build (Recommended)

The build only happens once. Subsequent starts will be much faster.

```bash
# Start everything and wait (this will take 5-10 minutes first time)
docker compose up --build
```

### Solution 2: Run Backend Locally (Faster for Development)

If you have Java 17+ and Maven installed locally:

```bash
# 1. Keep database and cache running
docker compose up -d postgres valkey

# 2. Run backend locally
cd backend
mvn spring-boot:run

# 3. In another terminal, run frontend
cd frontend
npm install
npm run dev
```

### Solution 3: Use Pre-built Images (Future)

We can create pre-built images and push to Docker Hub for faster startup.

## Common Issues

### 1. PostgreSQL Won't Start

**Symptom**: `could not open directory "pg_notify"`

**Solution**: Clean up corrupted data
```bash
docker compose down -v
docker volume rm enterprise-resource-planning_postgres-data
docker compose up -d postgres
```

### 2. Port Already in Use

**Symptom**: `port is already allocated`

**Solution**: Stop conflicting services
```bash
# Check what's using the port
lsof -i :8080  # or :5173, :5432, :6379

# Stop Docker services
docker compose down

# Or change ports in compose.yaml
```

### 3. Frontend Can't Connect to Backend

**Symptom**: CORS errors or connection refused

**Solution**: 
- Ensure backend is running: `curl http://localhost:8080/api/v1/health`
- Check CORS configuration in `SecurityConfig.java`
- Verify API_BASE_URL in frontend

### 4. Maven Build Fails

**Symptom**: Dependency resolution errors

**Solution**:
```bash
# Clear Maven cache and rebuild
docker compose down
docker compose build --no-cache backend
docker compose up backend
```

## Verification Steps

### 1. Check Database
```bash
docker compose exec postgres psql -U mulaerp -d mulaerp -c "SELECT version();"
```

Expected: PostgreSQL version info

### 2. Check Cache
```bash
docker compose exec valkey valkey-cli -a mulaerp-redis-password PING
```

Expected: `PONG`

### 3. Check Backend Health
```bash
curl http://localhost:8080/api/v1/health
```

Expected:
```json
{
  "status": "UP",
  "timestamp": "...",
  "service": "Mula ERP Backend"
}
```

### 4. Test Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mulaerp.com","password":"admin123"}'
```

Expected: JWT token and user info

### 5. Check Frontend
Open http://localhost:5173 in browser

Expected: Login page

## Current Build Progress

To monitor the backend build:

```bash
# Watch build logs
docker compose logs -f backend

# Check if backend container is running
docker compose ps backend

# Check backend container logs
docker compose logs backend | tail -50
```

## Quick Start (After First Build)

Once everything is built, starting is fast:

```bash
# Start everything
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Stop everything
docker compose down
```

## Performance Tips

### Speed Up Builds

1. **Use Docker BuildKit**:
```bash
export DOCKER_BUILDKIT=1
docker compose build
```

2. **Increase Docker Resources**:
- Docker Desktop → Settings → Resources
- Increase CPU: 4+ cores
- Increase Memory: 4GB+

3. **Use Local Maven Cache**:
Add to backend service in compose.yaml:
```yaml
volumes:
  - ~/.m2:/root/.m2
```

### Speed Up Development

1. **Use Hot Reload**:
- Frontend: Vite dev server (already configured)
- Backend: Spring DevTools (already included)

2. **Run Services Separately**:
```bash
# Only start what you need
docker compose up -d postgres valkey
# Then run backend/frontend locally
```

## Getting Help

If you're still stuck:

1. Check the logs:
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

2. Verify environment:
```bash
cat .env
docker compose config
```

3. Check Docker resources:
```bash
docker system df
docker system prune  # Clean up if needed
```

## Next Steps

Once everything is running:

1. ✅ Login at http://localhost:5173
2. ✅ Use credentials: admin@mulaerp.com / admin123
3. ✅ Explore the dashboard
4. 📖 Read `development-guide.md` for next steps
5. 🚀 Start building Phase 1 features!

## Estimated Times

- **First build**: 5-10 minutes
- **Subsequent starts**: 30-60 seconds
- **Backend restart**: 10-20 seconds
- **Frontend restart**: 5-10 seconds

## Current Status Check

Run this to see what's working:

```bash
echo "=== Docker Services ==="
docker compose ps

echo -e "\n=== Database ==="
docker compose exec postgres pg_isready -U mulaerp

echo -e "\n=== Cache ==="
docker compose exec valkey valkey-cli -a mulaerp-redis-password PING

echo -e "\n=== Backend Health ==="
curl -s http://localhost:8080/api/v1/health || echo "Backend not ready yet"

echo -e "\n=== Frontend ==="
curl -s http://localhost:5173 > /dev/null && echo "Frontend is up" || echo "Frontend not ready yet"
```
