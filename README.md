# Mula ERP - Enterprise Resource Planning System

A modern, full-featured ERP system built with React, Spring Boot, and PostgreSQL.

## 🚀 Quick Start

```bash
# Start all services
docker compose up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
# API Docs: http://localhost:8080/swagger-ui.html
# Metrics: http://localhost:8080/actuator
```

**Default Login**: `admin@mulaerp.com` / `admin123`

⚠️ **Important**: Change default password in production!

## 📁 Project Structure

```
enterprise-resource-planning/
├── README.md              # This file
├── compose.yaml           # Docker Compose configuration
├── .env.example           # Environment variables template
│
├── frontend/              # React + TypeScript + Vite
├── backend/               # Java Spring Boot + PostgreSQL
│
├── docs/                  # 📚 Documentation
│   ├── phases/           # Phase completion documents
│   └── guides/           # Development guides
│
├── scripts/               # 🔧 Utility scripts
│   ├── start-dev.sh      # Start development environment
│   ├── validate-phases.sh # Validate all phases
│   └── test-*.sh         # Test scripts
│
├── docker/                # 🐳 Docker configurations
│   ├── nginx/            # Nginx reverse proxy config
│   └── init-scripts/     # Database initialization
│
└── .kiro/                 # Kiro IDE configuration
    └── steering/         # Project guidelines
```

## 🎨 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Java Spring Boot 3.2 + PostgreSQL 16
- **Cache**: Valkey 7.2 (Redis fork)
- **Auth**: JWT with Spring Security
- **Migrations**: Flyway
- **Container**: Docker + Docker Compose

## 📊 Current Features

### ✅ Completed Modules
1. **Product Management** - Full CRUD, categories, low stock tracking, caching
2. **Customer Management** - Full CRUD, credit limits, search
3. **Supplier Management** - Full CRUD, payment terms, search
4. **Sales Orders** - Multi-line items, status workflow, calculations
5. **Dashboard** - Metrics, charts, recent activity
6. **Reports** - Sales reports, inventory reports, analytics
7. **Notifications** - Real-time alerts, low stock notifications
8. **Global Search** - Search across all entities

### 🎨 UI Component Library
- 14 reusable components (DataTable, Modal, Toast, Forms, etc.)
- Modern gradient design with purple/pink/blue theme
- Professional UX with animations and transitions
- Lazy loading and code splitting for performance

### 🔒 Security & Performance
- JWT authentication with Spring Security
- Rate limiting (100 req/min per IP)
- Redis caching with optimized TTLs
- Database indexes for fast queries
- Audit logging for compliance
- Security headers (CSP, X-Frame-Options, etc.)

### 📈 Progress
- **Phase 0**: ✅ 100% - Foundation
- **Phase 1**: ✅ 100% - Core Infrastructure
- **Phase 2**: ✅ 100% - Frontend Foundation
- **Phase 3**: ✅ 100% - ERP Modules
- **Phase 4**: ✅ 100% - Advanced Features
- **Phase 5**: ✅ 100% - Production Ready

**Overall**: ✅ 100% Complete - Production Ready!

## 🔧 Development

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (optional, for local dev)
- Java 17+ (optional, for local dev)

### Environment Setup

1. **Copy environment template**:
```bash
cp .env.example .env
```

2. **Start services**:
```bash
docker compose up --build
```

3. **Run validation**:
```bash
./scripts/validate-phases.sh
```

### Local Development (Without Docker)

**Backend**:
```bash
docker compose up postgres valkey -d
cd backend && mvn spring-boot:run
```

**Frontend**:
```bash
cd frontend && npm install && npm run dev
```

## 📚 Documentation

- **User Manual**: `docs/USER_MANUAL.md` - Complete user guide
- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE.md` - Production deployment instructions
- **Architecture**: `docs/ARCHITECTURE.md` - System architecture and design
- **API Documentation**: `docs/API_DOCUMENTATION.md` - REST API reference
- **Phase Documentation**: `docs/phases/` - Detailed phase completion docs
- **Project Guidelines**: `.kiro/steering/` - Tech stack, structure, recovery plan
- **Interactive API Docs**: http://localhost:8080/swagger-ui.html

## 🧪 Testing

```bash
# Validate all phases
./scripts/validate-phases.sh

# Test specific phase
./scripts/test-phase1.sh
./scripts/test-phase3.sh
```

## 📖 Key Documents

| Document | Description |
|----------|-------------|
| `docs/phases/PHASE_*_COMPLETE.md` | Phase completion summaries |
| `docs/guides/CURRENT_STATUS.md` | Overall project status |
| `docs/guides/PHASE_TRACKING.md` | Detailed progress tracking |
| `.kiro/steering/recovery-plan.md` | Complete implementation roadmap |
| `.kiro/steering/development-guide.md` | Development workflow guide |

## 🗺️ Roadmap

### ✅ Completed (All Phases)
- [x] Product Management
- [x] Customer Management
- [x] Supplier Management
- [x] Sales Orders
- [x] Dashboard & Analytics
- [x] Reports (Sales, Inventory)
- [x] Notifications System
- [x] Global Search
- [x] Performance Optimization
- [x] Security Hardening
- [x] Testing & Documentation
- [x] Production Ready

### 🚀 Future Enhancements (Optional)
- [ ] Purchase Orders Module
- [ ] Invoicing Module
- [ ] Payment Management
- [ ] User & Company Management
- [ ] Basic Accounting
- [ ] Email Notifications
- [ ] WebSocket Real-time Updates
- [ ] Mobile App (React Native)
- [ ] Multi-tenancy Support
- [ ] Advanced Analytics with ML

See `.kiro/steering/recovery-plan.md` for complete roadmap.

## 🐛 Troubleshooting

See `docs/guides/TROUBLESHOOTING.md` for common issues and solutions.

## 📄 License

MIT License

## 🙏 Acknowledgments

Inspired by [Odoo](https://github.com/odoo/odoo) and [ERPNext](https://github.com/frappe/erpnext)

---

**Built with ❤️ using modern open-source technologies**
