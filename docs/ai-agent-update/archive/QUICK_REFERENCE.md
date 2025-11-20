# Mula ERP - Quick Reference Guide

## 🚀 Quick Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Start with rebuild
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Access Points
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080
- **API Docs:** http://localhost:8080/swagger-ui.html
- **Health Check:** http://localhost:8080/api/v1/health
- **Metrics:** http://localhost:8080/actuator/metrics

### Default Credentials
- **Email:** admin@mulaerp.com
- **Password:** admin123

---

## 📁 Important Files

### Configuration
- `.env` - Environment variables
- `compose.yaml` - Docker Compose config
- `backend/src/main/resources/application.yml` - Backend config

### Documentation
- `docs/USER_MANUAL.md` - User guide
- `docs/DEPLOYMENT_GUIDE.md` - Deployment instructions
- `docs/ARCHITECTURE.md` - System architecture
- `docs/API_DOCUMENTATION.md` - API reference
- `PRODUCTION_READY.md` - Production readiness summary

### Development
- `.kiro/steering/development-guide.md` - Dev workflow
- `.kiro/steering/recovery-plan.md` - Complete roadmap
- `docs/phases/PHASE_5_COMPLETE.md` - Latest phase status

---

## 🔧 Development Commands

### Backend
```bash
cd backend

# Run locally
mvn spring-boot:run

# Run tests
mvn test

# Build
mvn clean package

# Skip tests
mvn clean package -DskipTests
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui
```

### Database
```bash
# Access PostgreSQL
docker-compose exec postgres psql -U mulaerp -d mulaerp

# Backup database
docker-compose exec postgres pg_dump -U mulaerp mulaerp > backup.sql

# Restore database
docker-compose exec -T postgres psql -U mulaerp mulaerp < backup.sql

# View backups
ls -lh postgres_backups/
```

### Cache
```bash
# Access Valkey CLI
docker-compose exec valkey valkey-cli -a ${REDIS_PASSWORD}

# Flush cache
docker-compose exec valkey valkey-cli -a ${REDIS_PASSWORD} FLUSHALL

# Check cache keys
docker-compose exec valkey valkey-cli -a ${REDIS_PASSWORD} KEYS '*'
```

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
mvn test

# Run specific test
mvn test -Dtest=ProductServiceTest

# Run with coverage
mvn test jacoco:report
```

### Frontend E2E Tests
```bash
cd frontend

# Run all tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run specific test
npx playwright test products.spec.ts

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View report
npx playwright show-report
```

---

## 📊 Monitoring

### Health Checks
```bash
# Application health
curl http://localhost:8080/api/v1/health

# Actuator health
curl http://localhost:8080/actuator/health

# Detailed health (requires auth)
curl -H "Authorization: Bearer <token>" http://localhost:8080/actuator/health
```

### Metrics
```bash
# All metrics
curl http://localhost:8080/actuator/metrics

# Specific metric
curl http://localhost:8080/actuator/metrics/jvm.memory.used

# Prometheus format
curl http://localhost:8080/actuator/prometheus
```

### Logs
```bash
# Application logs
tail -f logs/application.log

# Docker logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

---

## 🔒 Security

### Rate Limiting
- **Limit:** 100 requests per minute per IP
- **Header:** X-Rate-Limit-Remaining
- **Response:** 429 Too Many Requests (when exceeded)

### Authentication
```bash
# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mulaerp.com","password":"admin123"}'

# Use token
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/v1/products
```

### Security Headers
- Content-Security-Policy: default-src 'self'
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff

---

## 📦 Database Migrations

### View Migration Status
```bash
cd backend
mvn flyway:info
```

### Run Migrations
```bash
# Migrations run automatically on startup
# Or manually:
mvn flyway:migrate
```

### Migration Files
Located in: `backend/src/main/resources/db/migration/`
- V1__create_users_table.sql
- V2__create_core_tables.sql
- V3__create_sales_tables.sql
- V4__create_notifications_table.sql
- V10__add_performance_indexes.sql
- V11__create_audit_log_table.sql

---

## 🎨 UI Components

### Available Components
- Button
- Input
- Select
- Checkbox
- Modal
- Toast
- DataTable
- Card
- Badge
- Tabs
- Spinner
- Alert
- Dropdown
- DatePicker

### Usage Example
```tsx
import { Button, Modal, DataTable } from '@/components/ui';

<Button variant="primary" onClick={handleClick}>
  Save
</Button>
```

---

## 🔍 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Products
- `GET /api/v1/products` - List products
- `GET /api/v1/products/{id}` - Get product
- `POST /api/v1/products` - Create product
- `PUT /api/v1/products/{id}` - Update product
- `DELETE /api/v1/products/{id}` - Delete product
- `GET /api/v1/products/search?q=query` - Search products
- `GET /api/v1/products/low-stock` - Low stock products
- `GET /api/v1/products/categories` - Get categories

### Customers
- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/{id}` - Get customer
- `POST /api/v1/customers` - Create customer
- `PUT /api/v1/customers/{id}` - Update customer
- `DELETE /api/v1/customers/{id}` - Delete customer
- `GET /api/v1/customers/search?q=query` - Search customers

### Suppliers
- `GET /api/v1/suppliers` - List suppliers
- `GET /api/v1/suppliers/{id}` - Get supplier
- `POST /api/v1/suppliers` - Create supplier
- `PUT /api/v1/suppliers/{id}` - Update supplier
- `DELETE /api/v1/suppliers/{id}` - Delete supplier
- `GET /api/v1/suppliers/search?q=query` - Search suppliers

### Sales Orders
- `GET /api/v1/sales-orders` - List orders
- `GET /api/v1/sales-orders/{id}` - Get order
- `POST /api/v1/sales-orders` - Create order
- `PUT /api/v1/sales-orders/{id}` - Update order
- `PATCH /api/v1/sales-orders/{id}/status` - Update status
- `DELETE /api/v1/sales-orders/{id}` - Delete order

### Reports
- `GET /api/v1/reports/sales?startDate=&endDate=` - Sales report
- `GET /api/v1/reports/inventory` - Inventory report

### Analytics
- `GET /api/v1/analytics/dashboard` - Dashboard metrics

### Notifications
- `GET /api/v1/notifications` - Get notifications
- `PATCH /api/v1/notifications/{id}/read` - Mark as read
- `POST /api/v1/notifications/mark-all-read` - Mark all as read

### Search
- `GET /api/v1/search?q=query` - Global search

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Check database connection
docker-compose exec postgres psql -U mulaerp -d mulaerp

# Restart services
docker-compose restart backend
```

### Frontend Won't Load
```bash
# Check logs
docker-compose logs frontend

# Rebuild
docker-compose up --build frontend

# Check API connection
curl http://localhost:8080/api/v1/health
```

### Database Issues
```bash
# Reset database (⚠️ deletes all data)
docker-compose down -v
docker-compose up -d postgres
docker-compose up backend
```

### Cache Issues
```bash
# Clear cache
docker-compose exec valkey valkey-cli -a ${REDIS_PASSWORD} FLUSHALL

# Restart cache
docker-compose restart valkey
```

### Port Already in Use
```bash
# Find process using port
lsof -i :8080
lsof -i :5173

# Kill process
kill -9 <PID>

# Or change port in .env
```

---

## 📚 Documentation Links

### User Documentation
- [User Manual](docs/USER_MANUAL.md) - How to use the system
- [API Documentation](docs/API_DOCUMENTATION.md) - REST API reference

### Technical Documentation
- [Architecture](docs/ARCHITECTURE.md) - System design
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - How to deploy
- [Development Guide](.kiro/steering/development-guide.md) - How to develop

### Project Documentation
- [Recovery Plan](.kiro/steering/recovery-plan.md) - Complete roadmap
- [Phase 5 Complete](docs/phases/PHASE_5_COMPLETE.md) - Latest status
- [Production Ready](PRODUCTION_READY.md) - Production summary

---

## 🎯 Common Tasks

### Add a New Product
1. Navigate to Products
2. Click "Add Product"
3. Fill in SKU, Name, Price, Stock
4. Click "Save"

### Create a Sales Order
1. Navigate to Sales Orders
2. Click "Create Order"
3. Select Customer
4. Add line items (product + quantity)
5. Review totals
6. Click "Save"

### View Reports
1. Navigate to Reports
2. Select report type (Sales/Inventory)
3. Set date range (for sales report)
4. Click "Generate Report"
5. Click "Export" to download

### Search Globally
1. Click search icon (top right)
2. Enter search term
3. View results from all entities
4. Click result to navigate

---

## 🔑 Environment Variables

### Required
- `DATABASE_PASSWORD` - PostgreSQL password
- `REDIS_PASSWORD` - Valkey/Redis password
- `JWT_SECRET` - JWT signing secret (min 32 chars)

### Optional
- `DATABASE_HOST` - Database host (default: postgres)
- `DATABASE_PORT` - Database port (default: 5432)
- `DATABASE_NAME` - Database name (default: mulaerp)
- `REDIS_HOST` - Redis host (default: valkey)
- `REDIS_PORT` - Redis port (default: 6379)
- `BACKEND_PORT` - Backend port (default: 8080)
- `FRONTEND_PORT` - Frontend port (default: 5173)

---

## 📞 Getting Help

### Documentation
1. Check relevant documentation in `docs/`
2. Review API docs at `/swagger-ui.html`
3. Check phase completion docs in `docs/phases/`

### Debugging
1. Check application logs
2. Check Docker logs
3. Check health endpoints
4. Review error messages

### Common Issues
- See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) troubleshooting section
- See [User Manual](docs/USER_MANUAL.md) troubleshooting section

---

*Quick Reference - Version 1.0.0*  
*Last Updated: January 19, 2025*
