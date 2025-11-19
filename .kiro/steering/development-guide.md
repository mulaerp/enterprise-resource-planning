# Development Guide

## Phase 0 Completion Status ✅

### What We've Built

**Frontend (React + TypeScript + Vite)**:
- ✅ Project initialized with Vite
- ✅ Tailwind CSS configured
- ✅ React Router setup
- ✅ Authentication context
- ✅ API client with interceptors
- ✅ Login page
- ✅ Dashboard page (placeholder)
- ✅ Dependencies: axios, react-router-dom, lucide-react, react-hook-form, zod

**Backend (Java Spring Boot)**:
- ✅ Spring Boot 3.2 project structure
- ✅ PostgreSQL + JPA configuration
- ✅ Flyway migrations setup
- ✅ JWT authentication system
- ✅ Spring Security configuration
- ✅ User entity and repository
- ✅ Auth service and controller
- ✅ Global exception handler
- ✅ Health check endpoint
- ✅ Base entity with audit fields
- ✅ CORS configuration

**Database**:
- ✅ Users table migration
- ✅ Default admin user (email: admin@mulaerp.com, password: admin123)

**Infrastructure**:
- ✅ Converted to monorepo structure
- ✅ Docker Compose configuration updated
- ✅ Dockerfiles for frontend and backend
- ✅ Development environment setup

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)
- Java 17+ (for local development)
- Maven 3.9+ (for local development)

### Quick Start with Docker

1. **Start all services**:
```bash
docker-compose up --build
```

2. **Access the application**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- Health Check: http://localhost:8080/api/v1/health

3. **Login credentials**:
- Email: admin@mulaerp.com
- Password: admin123

### Local Development (Without Docker)

#### Backend

1. **Start PostgreSQL and Valkey**:
```bash
docker-compose up postgres valkey -d
```

2. **Run backend**:
```bash
cd backend
mvn spring-boot:run
```

Backend will be available at http://localhost:8080

#### Frontend

1. **Install dependencies**:
```bash
cd frontend
npm install
```

2. **Run development server**:
```bash
npm run dev
```

Frontend will be available at http://localhost:5173

## Project Structure

```
enterprise-resource-planning/
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── contexts/           # React contexts (Auth, etc.)
│   │   ├── lib/                # Utilities (API client)
│   │   ├── pages/              # Page components
│   │   │   ├── auth/           # Authentication pages
│   │   │   └── dashboard/      # Dashboard pages
│   │   ├── App.tsx             # Main app component
│   │   └── main.tsx            # Entry point
│   ├── Dockerfile              # Frontend Docker config
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend/                     # Spring Boot backend
│   ├── src/main/java/com/mulaerp/
│   │   ├── auth/               # Authentication module
│   │   │   ├── controller/     # REST controllers
│   │   │   ├── dto/            # Data transfer objects
│   │   │   ├── entity/         # JPA entities
│   │   │   ├── repository/     # Data repositories
│   │   │   ├── security/       # Security config, JWT
│   │   │   └── service/        # Business logic
│   │   ├── common/             # Shared components
│   │   │   ├── controller/     # Common controllers
│   │   │   ├── entity/         # Base entities
│   │   │   └── exception/      # Exception handlers
│   │   └── MulaErpApplication.java
│   ├── src/main/resources/
│   │   ├── db/migration/       # Flyway migrations
│   │   └── application.yml     # Configuration
│   ├── Dockerfile              # Backend Docker config
│   └── pom.xml                 # Maven dependencies
│
├── nginx/                       # Nginx config (for production)
├── postgres_data/               # PostgreSQL data (gitignored)
├── valkey_data/                # Valkey cache data (gitignored)
├── logs/                        # Application logs (gitignored)
├── .env                         # Environment variables
├── compose.yaml                 # Docker Compose config
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Health
- `GET /api/v1/health` - Health check

## Testing the Setup

### 1. Test Backend Health
```bash
curl http://localhost:8080/api/v1/health
```

Expected response:
```json
{
  "status": "UP",
  "timestamp": "2025-11-19T...",
  "service": "Mula ERP Backend"
}
```

### 2. Test Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mulaerp.com","password":"admin123"}'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@mulaerp.com",
    "fullName": "System Administrator",
    "role": "ADMIN"
  }
}
```

### 3. Test Frontend
1. Open http://localhost:5173
2. Login with admin@mulaerp.com / admin123
3. You should see the dashboard

## Common Issues & Solutions

### Backend won't start
- **Issue**: Database connection error
- **Solution**: Ensure PostgreSQL is running: `docker-compose up postgres -d`

### Frontend can't connect to backend
- **Issue**: CORS error
- **Solution**: Backend CORS is configured for localhost:5173. Check if backend is running.

### Database migration fails
- **Issue**: Flyway migration error
- **Solution**: Drop and recreate database:
```bash
docker-compose down -v
docker-compose up postgres -d
```

### Port already in use
- **Issue**: Port 8080 or 5173 already in use
- **Solution**: Stop other services or change ports in compose.yaml

## Next Steps (Phase 1)

Now that Phase 0 is complete, we can proceed to Phase 1:

1. **Database Schema** - Create remaining tables (products, customers, orders, etc.)
2. **Product Module** - CRUD operations for products
3. **Customer Module** - CRUD operations for customers
4. **UI Components** - Build reusable components (DataTable, Forms, etc.)

See `recovery-plan.md` for the complete roadmap.

## Development Workflow

### Adding a New Feature

1. **Backend**:
   - Create entity in `backend/src/main/java/com/mulaerp/{module}/entity/`
   - Create repository in `{module}/repository/`
   - Create DTOs in `{module}/dto/`
   - Create service in `{module}/service/`
   - Create controller in `{module}/controller/`
   - Add migration in `backend/src/main/resources/db/migration/`

2. **Frontend**:
   - Create page in `frontend/src/pages/{module}/`
   - Add route in `App.tsx`
   - Create API calls in service file
   - Add navigation link

### Database Migrations

Create new migration file:
```bash
# Format: V{version}__{description}.sql
# Example: V2__create_products_table.sql
```

Migration will run automatically on backend startup.

### Code Style

**Backend**:
- Use Lombok for getters/setters
- Follow Spring Boot conventions
- Use DTOs for API requests/responses
- Add validation annotations

**Frontend**:
- Use TypeScript strictly
- Follow React hooks patterns
- Use Tailwind for styling
- Keep components small and focused

## Useful Commands

### Docker
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend
```

### Backend
```bash
cd backend

# Run tests
mvn test

# Clean and build
mvn clean package

# Run without Docker
mvn spring-boot:run
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

# Preview production build
npm run preview
```

### Database
```bash
# Access PostgreSQL
docker-compose exec postgres psql -U mulaerp -d mulaerp

# Backup database
docker-compose exec postgres pg_dump -U mulaerp mulaerp > backup.sql

# Restore database
docker-compose exec -T postgres psql -U mulaerp -d mulaerp < backup.sql
```

## Environment Variables

Key environment variables (see `.env`):

- `DATABASE_PASSWORD` - PostgreSQL password
- `REDIS_PASSWORD` - Valkey/Redis password
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `SPRING_PROFILES_ACTIVE` - Spring profile (development/production)
- `NODE_ENV` - Node environment

## Security Notes

⚠️ **Important for Production**:
1. Change default passwords in `.env`
2. Use strong JWT secret (min 32 characters)
3. Enable HTTPS with SSL certificates
4. Update CORS origins in SecurityConfig.java
5. Enable rate limiting
6. Review security headers
7. Use environment-specific configs

## Support & Resources

- Spring Boot Docs: https://spring.io/projects/spring-boot
- React Docs: https://react.dev
- Tailwind CSS: https://tailwindcss.com
- Vite: https://vitejs.dev

## Phase 0 Summary

✅ **Completed**:
- Monorepo structure established
- Frontend with React + TypeScript + Tailwind
- Backend with Spring Boot + PostgreSQL
- JWT authentication working
- Docker development environment
- Basic UI (login + dashboard)
- Database migrations setup

🎯 **Ready for Phase 1**: Core ERP modules development
