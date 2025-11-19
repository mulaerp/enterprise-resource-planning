# Mula ERP Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Database Setup](#database-setup)
6. [Configuration](#configuration)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB
- OS: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2

**Recommended Requirements:**
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 50+ GB SSD
- OS: Linux (Ubuntu 22.04 LTS)

### Software Requirements

- **Docker** 24.0+ and **Docker Compose** 2.20+
- **PostgreSQL** 16+ (if not using Docker)
- **Redis/Valkey** 7.2+ (if not using Docker)
- **Node.js** 20+ (for frontend development)
- **Java** 17+ (for backend development)
- **Maven** 3.9+ (for backend build)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/mula-erp.git
cd mula-erp
```

### 2. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `.env` file with your settings:

```bash
# Database Configuration
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=mulaerp
DATABASE_USER=mulaerp
DATABASE_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# Redis/Valkey Configuration
REDIS_HOST=valkey
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# JWT Configuration
JWT_SECRET=CHANGE_THIS_TO_A_STRONG_SECRET_MIN_32_CHARS

# Application Configuration
SPRING_PROFILES_ACTIVE=production
NODE_ENV=production

# Ports
BACKEND_PORT=8080
FRONTEND_PORT=5173
NGINX_PORT=80
NGINX_SSL_PORT=443
```

⚠️ **Important:** Change all default passwords and secrets in production!

---

## Docker Deployment

### Production Deployment with Docker Compose

#### 1. Build and Start Services

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

#### 2. Verify Deployment

```bash
# Check backend health
curl http://localhost:8080/api/v1/health

# Check frontend
curl http://localhost:5173

# Check Nginx proxy
curl http://localhost
```

#### 3. Create Admin User

The default admin user is created automatically via database migration:
- Email: `admin@mulaerp.com`
- Password: `admin123`

⚠️ **Change this password immediately after first login!**

#### 4. Access the Application

- **Frontend:** http://localhost (via Nginx) or http://localhost:5173 (direct)
- **Backend API:** http://localhost:8080
- **API Documentation:** http://localhost:8080/swagger-ui.html
- **Actuator Metrics:** http://localhost:8080/actuator

### Docker Compose Services

The deployment includes:
- **postgres** - PostgreSQL database
- **valkey** - Redis-compatible cache
- **backend** - Spring Boot API
- **frontend** - React application
- **nginx** - Reverse proxy
- **db-backup** - Automated database backups

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

---

## Manual Deployment

### Backend Deployment

#### 1. Build the Backend

```bash
cd backend
mvn clean package -DskipTests
```

This creates `target/mula-erp-backend-1.0.0.jar`

#### 2. Configure Application

Create `application-production.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://your-db-host:5432/mulaerp
    username: mulaerp
    password: ${DATABASE_PASSWORD}
  
  data:
    redis:
      host: your-redis-host
      port: 6379
      password: ${REDIS_PASSWORD}

jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000

logging:
  level:
    root: INFO
    com.mulaerp: INFO
```

#### 3. Run the Backend

```bash
java -jar target/mula-erp-backend-1.0.0.jar \
  --spring.profiles.active=production \
  --server.port=8080
```

#### 4. Run as System Service (Linux)

Create `/etc/systemd/system/mula-erp-backend.service`:

```ini
[Unit]
Description=Mula ERP Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=mulaerp
WorkingDirectory=/opt/mula-erp/backend
ExecStart=/usr/bin/java -jar /opt/mula-erp/backend/mula-erp-backend-1.0.0.jar --spring.profiles.active=production
Restart=on-failure
RestartSec=10

Environment="DATABASE_PASSWORD=your_password"
Environment="REDIS_PASSWORD=your_password"
Environment="JWT_SECRET=your_secret"

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mula-erp-backend
sudo systemctl start mula-erp-backend
sudo systemctl status mula-erp-backend
```

### Frontend Deployment

#### 1. Build the Frontend

```bash
cd frontend
npm install
npm run build
```

This creates `dist/` directory with static files.

#### 2. Serve with Nginx

Copy files to web server:

```bash
sudo cp -r dist/* /var/www/mula-erp/
```

Configure Nginx (`/etc/nginx/sites-available/mula-erp`):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/mula-erp;
    index index.html;
    
    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/mula-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Database Setup

### PostgreSQL Installation

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql-16 postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Create Database and User

```bash
sudo -u postgres psql

CREATE DATABASE mulaerp;
CREATE USER mulaerp WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE mulaerp TO mulaerp;
\q
```

### Database Migrations

Migrations run automatically on backend startup via Flyway.

To run manually:

```bash
cd backend
mvn flyway:migrate -Dflyway.url=jdbc:postgresql://localhost:5432/mulaerp \
  -Dflyway.user=mulaerp \
  -Dflyway.password=your_password
```

### Database Backup

#### Automated Backups (Docker)

Backups run daily at 2 AM (configurable in `compose.yaml`).

Backups are stored in `./postgres_backups/` with 7-day retention.

#### Manual Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U mulaerp mulaerp > backup_$(date +%Y%m%d).sql

# Or without Docker
pg_dump -U mulaerp -h localhost mulaerp > backup_$(date +%Y%m%d).sql
```

#### Restore from Backup

```bash
# Restore
docker-compose exec -T postgres psql -U mulaerp mulaerp < backup_20250119.sql

# Or without Docker
psql -U mulaerp -h localhost mulaerp < backup_20250119.sql
```

---

## Configuration

### Backend Configuration

Key configuration files:
- `backend/src/main/resources/application.yml` - Main config
- `backend/src/main/resources/application-production.yml` - Production overrides

### Frontend Configuration

Environment variables (`.env.production`):

```bash
VITE_API_URL=http://your-domain.com/api/v1
VITE_APP_NAME=Mula ERP
```

Build with production config:

```bash
npm run build
```

### Nginx Configuration

Production Nginx config with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    root /var/www/mula-erp;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Security Considerations

### 1. Change Default Credentials

- Database passwords
- Redis password
- JWT secret
- Admin user password

### 2. Enable HTTPS

Use Let's Encrypt for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 4. Database Security

- Use strong passwords
- Restrict database access to localhost or specific IPs
- Enable SSL for database connections
- Regular backups

### 5. Application Security

- Keep dependencies updated
- Monitor security advisories
- Enable rate limiting (already configured)
- Review audit logs regularly
- Use environment variables for secrets (never commit to git)

### 6. Network Security

- Use VPN for administrative access
- Implement IP whitelisting for admin endpoints
- Use reverse proxy (Nginx) for additional security layer
- Enable DDoS protection

---

## Monitoring & Maintenance

### Health Checks

```bash
# Backend health
curl http://localhost:8080/api/v1/health

# Actuator endpoints
curl http://localhost:8080/actuator/health
curl http://localhost:8080/actuator/metrics
curl http://localhost:8080/actuator/info
```

### Logs

#### Docker Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

#### Application Logs

- Backend: `logs/application.log`
- Nginx: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`

### Performance Monitoring

Monitor key metrics:
- CPU usage
- Memory usage
- Disk space
- Database connections
- API response times
- Cache hit rates

### Database Maintenance

```bash
# Vacuum database
docker-compose exec postgres psql -U mulaerp -d mulaerp -c "VACUUM ANALYZE;"

# Check database size
docker-compose exec postgres psql -U mulaerp -d mulaerp -c "SELECT pg_size_pretty(pg_database_size('mulaerp'));"
```

### Updates

#### Update Backend

```bash
cd backend
git pull
mvn clean package -DskipTests
docker-compose up -d --build backend
```

#### Update Frontend

```bash
cd frontend
git pull
npm install
npm run build
docker-compose up -d --build frontend
```

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
docker-compose logs backend
```

**Common issues:**
- Database connection failed - verify DATABASE_* env vars
- Port already in use - change BACKEND_PORT
- Migration failed - check database permissions

### Frontend Won't Load

**Check logs:**
```bash
docker-compose logs frontend
docker-compose logs nginx
```

**Common issues:**
- API connection failed - verify VITE_API_URL
- Build failed - check Node.js version
- Nginx misconfigured - verify nginx.conf

### Database Connection Issues

**Test connection:**
```bash
docker-compose exec postgres psql -U mulaerp -d mulaerp
```

**Common issues:**
- Wrong credentials - check .env file
- Database not ready - wait for postgres to fully start
- Network issues - check docker network

### Performance Issues

**Check resource usage:**
```bash
docker stats
```

**Common solutions:**
- Increase memory allocation
- Add database indexes (already done in Phase 5.1)
- Enable Redis caching (already configured)
- Optimize queries

### Cache Issues

**Clear Redis cache:**
```bash
docker-compose exec valkey valkey-cli -a ${REDIS_PASSWORD} FLUSHALL
```

---

## Backup & Recovery

### Full System Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U mulaerp mulaerp > backup_db.sql

# Backup volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_data.tar.gz /data
docker run --rm -v valkey_data:/data -v $(pwd):/backup ubuntu tar czf /backup/valkey_data.tar.gz /data

# Backup configuration
tar czf config_backup.tar.gz .env compose.yaml nginx/
```

### Disaster Recovery

```bash
# Restore database
docker-compose exec -T postgres psql -U mulaerp mulaerp < backup_db.sql

# Restore volumes
docker run --rm -v postgres_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/postgres_data.tar.gz -C /

# Restart services
docker-compose restart
```

---

## Production Checklist

- [ ] Change all default passwords
- [ ] Configure strong JWT secret (min 32 characters)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Review and harden security settings
- [ ] Test disaster recovery procedures
- [ ] Document custom configurations
- [ ] Set up log rotation
- [ ] Configure email notifications
- [ ] Test all critical workflows
- [ ] Train users on the system
- [ ] Prepare support documentation

---

*Last Updated: Phase 5 - Production Ready*
*Version: 1.0.0*
