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
- **Real-time**: WebSocket (STOMP over SockJS)
- **Auth**: JWT with Spring Security
- **Migrations**: Flyway
- **Container**: Docker + Docker Compose
- **Testing**: Playwright (E2E), JUnit (Unit)

## 📊 Project Statistics

- **Total Code**: ~41,000 lines
- **Backend**: ~18,000 lines (Java)
- **Frontend**: ~12,000 lines (TypeScript/React)
- **Tests**: ~2,000 lines
- **Documentation**: ~9,000 lines
- **API Endpoints**: 70+
- **Database Tables**: 24
- **Frontend Pages**: 40+
- **Reusable Components**: 14
- **Fully Functional Modules**: 15
- **Infrastructure-Only Features**: 5 (not yet functional)

## 📊 Current Features

### ✅ Completed Modules

#### Core ERP (Phases 0-5)
1. **Product Management** - Full CRUD, categories, low stock tracking, caching
2. **Customer Management** - Full CRUD, credit limits, search
3. **Supplier Management** - Full CRUD, payment terms, search
4. **Sales Orders** - Multi-line items, status workflow, calculations
5. **Dashboard** - Metrics, charts, recent activity
6. **Reports** - Sales reports, inventory reports, analytics
7. **Notifications** - Real-time alerts, low stock notifications
8. **Global Search** - Search across all entities

#### Advanced Features (Phase 6)
9. **Purchase Orders** - Full procurement workflow, stock receiving
10. **Invoicing** - Multi-line invoices, payment tracking, overdue alerts
11. **Payments** - Payment recording, invoice allocation, multiple methods
12. **User Management** - User CRUD, role management, permissions
13. **Company Settings** - Company profile, multi-company support
14. **Accounting** - Double-entry bookkeeping, chart of accounts, journal entries, trial balance
15. **Real-time Updates** - WebSocket notifications for orders, stock, invoices
16. **Advanced Inventory** - Stock adjustments, batch tracking, multi-warehouse support

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
- **Phase 3**: ✅ 100% - Core ERP Modules
- **Phase 4**: ✅ 100% - Advanced Features
- **Phase 5**: ✅ 100% - Performance & Security
- **Phase 6**: ⏳ 62.5% - Advanced ERP Features (5/8 modules complete)

**Overall**: ⏳ ~85% Complete - Core ERP Functional, Advanced Features In Progress

**See `.kiro/steering/feature-status.md` for detailed feature tracking**

## ✨ Latest Features (Phase 6)

### ✅ Fully Functional

#### 🧮 Accounting System
- **Double-entry Bookkeeping** - Full accounting with balanced entries
- **Chart of Accounts** - 30+ default accounts (Assets, Liabilities, Equity, Revenue, Expenses)
- **Journal Entries** - Create and post journal entries with validation
- **Trial Balance** - Real-time trial balance report
- **Account Ledger** - View transaction history by account

#### 🔔 Real-time Updates
- **WebSocket Integration** - STOMP over SockJS for live updates
- **Live Notifications** - Real-time alerts for orders, stock changes
- **Connection Indicator** - Visual status in sidebar
- **Automatic Toasts** - Instant feedback for events

#### 💼 Business Management
- **Purchase Orders** - Full procurement workflow with stock receiving
- **Invoicing** - Multi-line invoices with payment tracking
- **Payments** - Record payments with invoice allocation
- **User Management** - User CRUD with role-based permissions
- **Company Settings** - Multi-company support

#### 📦 Basic Inventory
- **Stock Adjustments** - INCREASE, DECREASE, RECOUNT with reason tracking

### 🔶 Infrastructure Only (Coming Soon)

These features have database tables and entities created, but are **not yet functional**:
- **Batch/Lot Tracking** - Needs: Repository, Service, Controller, UI
- **Serial Numbers** - Needs: Entity, Repository, Service, Controller, UI
- **Multi-warehouse** - Needs: Entity, Service integration, UI
- **Stock Transfers** - Needs: Repository, Service, Controller, UI
- **Email Notifications** - Needs: Templates, Integration with modules

## 🔧 Development

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (optional, for local dev)
- Java 21+ (optional, for local dev)

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

### User Documentation
- **User Manual**: `docs/USER_MANUAL.md` - Complete user guide
- **Quick Reference**: `QUICK_REFERENCE.md` - Common commands and tasks
- **Production Ready**: `PRODUCTION_READY.md` - Production readiness summary

### Technical Documentation
- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE.md` - Production deployment instructions
- **Architecture**: `docs/ARCHITECTURE.md` - System architecture and design
- **API Documentation**: `docs/API_DOCUMENTATION.md` - REST API reference
- **Interactive API Docs**: http://localhost:8080/swagger-ui.html

### Phase Documentation
- **Phase 6 Complete**: `docs/phases/PHASE_6_COMPLETE.md` - Latest features (Accounting, WebSocket, Inventory)
- **Phase 6 Installation**: `PHASE_6_INSTALLATION.md` - Setup guide for Phase 6 features
- **Phase 6 Quick Reference**: `PHASE_6_QUICK_REFERENCE.md` - Quick reference for new features
- **All Phases**: `docs/phases/` - Complete phase documentation

### Project Guidelines
- **Feature Status**: `.kiro/steering/feature-status.md` - **Honest feature tracking (source of truth)**
- **Development Guide**: `.kiro/steering/development-guide.md` - Development workflow
- **Tech Stack**: `.kiro/steering/tech.md` - Technology stack details
- **Testing Guide**: `.kiro/steering/testing.md` - E2E testing with Playwright
- **Product Overview**: `.kiro/steering/product.md` - Product description
- **Project Structure**: `.kiro/steering/structure.md` - Repository organization

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

### ✅ Fully Functional (15 Modules)

**Core ERP Features:**
- [x] Product Management
- [x] Customer Management
- [x] Supplier Management
- [x] Sales Orders
- [x] Purchase Orders
- [x] Invoicing
- [x] Payments
- [x] Dashboard & Analytics
- [x] Reports (Sales, Inventory)
- [x] Notifications System
- [x] Global Search

**Advanced Features:**
- [x] User & Company Management
- [x] Basic Accounting (Double-entry, Chart of Accounts, Journal Entries, Trial Balance)
- [x] WebSocket Real-time Updates
- [x] Stock Adjustments

### 🔶 Infrastructure Only (Not Yet Functional)
- [ ] Email Notifications (service exists, needs templates & integration)
- [ ] Batch/Lot Tracking (database + entity only)
- [ ] Serial Number Tracking (database only)
- [ ] Stock Transfers (database + entities only)
- [ ] Multi-warehouse Support (database only)

### 🚀 Planned Features
- [ ] Complete Batch/Lot Tracking (Repository, Service, Controller, UI)
- [ ] Complete Serial Number Tracking (Entity, Repository, Service, Controller, UI)
- [ ] Complete Stock Transfer Workflow (Repository, Service, Controller, UI)
- [ ] Complete Multi-warehouse Integration (Entity, Service, UI)
- [ ] Complete Email Notifications (Templates, Integration)
- [ ] Financial Statements (P&L, Balance Sheet)
- [ ] Automatic Journal Entries from Transactions
- [ ] Mobile App (React Native)
- [ ] Multi-tenancy Support
- [ ] Advanced Analytics with ML
- [ ] Manufacturing Module (MRP)
- [ ] HR Management Module

**See `.kiro/steering/feature-status.md` for detailed status of each feature**

See `.kiro/steering/recovery-plan.md` for complete roadmap.

## 🐛 Troubleshooting

See `docs/guides/TROUBLESHOOTING.md` for common issues and solutions.

## 📄 License

MIT License

## 🙏 Acknowledgments

Inspired by [Odoo](https://github.com/odoo/odoo) and [ERPNext](https://github.com/frappe/erpnext)

---

**Built with ❤️ using modern open-source technologies**
