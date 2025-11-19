# Mula ERP - Enterprise Resource Planning System

A modern, full-featured ERP system built with React, Spring Boot, and PostgreSQL.

## 🚀 Quick Start

```bash
# Start all services
docker compose up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
```

**Default Login**: `admin@mulaerp.com` / `admin123`

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
1. **Product Management** - Full CRUD, categories, low stock tracking
2. **Customer Management** - Full CRUD, credit limits
3. **Supplier Management** - Full CRUD, payment terms
4. **Sales Orders** - Multi-line items, status workflow, calculations

### 🎨 UI Component Library
- 14 reusable components (DataTable, Modal, Toast, Forms, etc.)
- Modern gradient design with purple/pink/blue theme
- Professional UX with animations and transitions

### 📈 Progress
- **Phase 0**: ✅ 100% - Foundation
- **Phase 1**: ✅ 90% - Core Infrastructure
- **Phase 2**: ✅ 90% - Frontend Foundation
- **Phase 3**: ⚠️ 25% - ERP Modules (4 of 8 complete)

**Overall**: 65% Complete

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

- **Phase Documentation**: `docs/phases/` - Detailed phase completion docs
- **Development Guides**: `docs/guides/` - Implementation guides and tracking
- **Project Guidelines**: `.kiro/steering/` - Tech stack, structure, recovery plan
- **API Docs**: See backend Swagger UI (when implemented)

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

### Next Steps (Phase 3 Completion)
- [ ] Purchase Orders Module
- [ ] Invoicing Module
- [ ] Payment Management
- [ ] User & Company Management

### Future (Phase 4+)
- [ ] Dashboard Analytics
- [ ] Reporting System
- [ ] Basic Accounting
- [ ] Advanced Features

See `docs/guides/PHASE_TRACKING.md` for detailed progress.

## 🐛 Troubleshooting

See `docs/guides/TROUBLESHOOTING.md` for common issues and solutions.

## 📄 License

MIT License

## 🙏 Acknowledgments

Inspired by [Odoo](https://github.com/odoo/odoo) and [ERPNext](https://github.com/frappe/erpnext)

---

**Built with ❤️ using modern open-source technologies**
