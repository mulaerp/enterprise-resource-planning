# Mula ERP - Enterprise Resource Planning System

A full-featured Enterprise Resource Planning (ERP) system built with modern technologies.

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Java Spring Boot 3.2 + PostgreSQL + Spring Security
- **Cache**: Valkey (Redis fork)
- **Authentication**: JWT
- **Database Migrations**: Flyway
- **Containerization**: Docker + Docker Compose

## 📁 Project Structure (Monorepo)

```
enterprise-resource-planning/
├── frontend/          # React TypeScript application
├── backend/           # Spring Boot application
├── nginx/             # Nginx configuration (production)
├── postgres_data/     # PostgreSQL data (gitignored)
├── valkey_data/       # Valkey cache data (gitignored)
└── compose.yaml       # Docker Compose orchestration
```

## 🏃 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (optional, for local development)
- Java 17+ (optional, for local development)

### Start with Docker

```bash
# Start all services
docker-compose up --build

# Or run in background
docker-compose up -d
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/api/v1/health

### Default Login Credentials

- **Email**: admin@mulaerp.com
- **Password**: admin123

## 🛠️ Local Development (Without Docker)

### Backend

1. Start PostgreSQL and Valkey:
```bash
docker-compose up postgres valkey -d
```

2. Run backend:
```bash
cd backend
mvn spring-boot:run
```

### Frontend

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run development server:
```bash
npm run dev
```

## 📊 Current Features (Phase 0 Complete)

- ✅ User authentication with JWT
- ✅ Login page
- ✅ Dashboard (basic)
- ✅ Database migrations
- ✅ Docker development environment
- ✅ CORS configuration
- ✅ Global exception handling

## 🗺️ Roadmap

### Phase 1 (In Progress)
- [ ] Product & Inventory Management
- [ ] Customer Management (CRM)
- [ ] Supplier Management
- [ ] UI Component Library

### Phase 2
- [ ] Sales Orders
- [ ] Purchase Orders
- [ ] Invoicing
- [ ] Payment Management

### Phase 3
- [ ] Dashboard & Analytics
- [ ] Reporting System
- [ ] Basic Accounting
- [ ] Notifications

See `.kiro/steering/recovery-plan.md` for the complete roadmap.

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_PASSWORD=mulaerp123
REDIS_PASSWORD=mulaerp-redis-password
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
```

## 📚 API Documentation

### Authentication
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

### Health
- `GET /api/v1/health` - Service health check

## 🧪 Testing

### Test Backend Health
```bash
curl http://localhost:8080/api/v1/health
```

### Test Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mulaerp.com","password":"admin123"}'
```

## 📖 Documentation

- **Development Guide**: `.kiro/steering/development-guide.md`
- **Recovery Plan**: `.kiro/steering/recovery-plan.md`
- **Tech Stack**: `.kiro/steering/tech.md`
- **Project Structure**: `.kiro/steering/structure.md`

## 🐛 Common Issues

### Port Already in Use
Stop other services using ports 5173, 8080, 5432, or 6379.

### Database Connection Error
Ensure PostgreSQL is running:
```bash
docker-compose up postgres -d
```

### Frontend Can't Connect to Backend
Check if backend is running and CORS is configured correctly.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Inspired by [Odoo](https://github.com/odoo/odoo) and [ERPNext](https://github.com/frappe/erpnext)
- Built with modern open-source technologies
