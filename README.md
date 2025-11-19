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

- **Total Code**: ~47,000 lines
- **Backend**: ~21,500 lines (Java)
- **Frontend**: ~13,200 lines (TypeScript/React)
- **Tests**: ~2,000 lines
- **Documentation**: ~10,300 lines
- **API Endpoints**: 101+
- **Database Tables**: 24
- **Frontend Pages**: 46+
- **Reusable Components**: 14
- **Fully Functional Modules**: 19
- **Infrastructure-Only Features**: 1 (multi-warehouse)

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
16. **Stock Adjustments** - Inventory adjustments with reason tracking
17. **Batch/Lot Tracking** - Batch numbers, expiry dates, FIFO support, expiry alerts
18. **Serial Number Tracking** - Unique serial numbers, warranty management, customer linking
19. **Stock Transfers** - Inter-warehouse transfers with workflow (PENDING → IN_TRANSIT → COMPLETED)
20. **Email Notifications** - Automated alerts for low stock, expiring batches/warranties, orders, invoices

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
- **Phase 6**: ✅ 87.5% - Advanced ERP Features (7/8 modules complete)

**Overall**: ✅ ~95% Complete - Comprehensive ERP System Ready for Production

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

#### 📦 Advanced Inventory Management
- **Stock Adjustments** - INCREASE, DECREASE, RECOUNT with reason tracking
- **Batch/Lot Tracking** - Batch numbers, manufacture/expiry dates, quantity per batch, FIFO support
- **Serial Number Tracking** - Unique serial numbers, warranty management, customer linking, status tracking
- **Stock Transfers** - Inter-warehouse transfers with workflow (PENDING → IN_TRANSIT → COMPLETED)
- **Expiry Alerts** - Automated 30-day warnings for expiring batches and warranties

#### 📧 Email Notifications
- **Automated Alerts** - Daily scheduled jobs (9 AM) for low stock, expiring batches, expiring warranties
- **Transaction Emails** - Order confirmations, invoice notifications, payment receipts
- **7 Professional Templates** - Low stock, order confirmation, invoice, payment, user registration, batch expiry, warranty expiry
- **SMTP Integration** - Supports Gmail, Outlook, SendGrid, AWS SES

### 🔶 Infrastructure Only (Coming Soon)

- **Multi-warehouse Support** - Database exists, needs entity and full service integration (2-3 weeks)

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

2. **Configure Email (Optional)**:
```yaml
# backend/src/main/resources/application.yml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: your-email@gmail.com
    password: your-app-password  # Generate from Google Account
    from: noreply@mulaerp.com
```

3. **Start services**:
```bash
docker compose up --build
```

4. **Run validation**:
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

**Documentation Index:** [`docs/README.md`](docs/README.md)

### Essential Docs
- **[User Manual](docs/USER_MANUAL.md)** - How to use the system
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - How to deploy
- **[Architecture](docs/ARCHITECTURE.md)** - System design
- **[API Docs](docs/API_DOCUMENTATION.md)** - REST API reference

### New Features (Phase 6.6 & 6.8)
- **[Inventory Features Guide](docs/INVENTORY_FEATURES.md)** - 📦 Complete guide to batch tracking, serial numbers, stock transfers
- **[Quick Start: Inventory](docs/QUICK_START_INVENTORY.md)** - ⚡ Get started in 5 minutes
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - 📋 What was implemented

### Project Status
- **[Feature Status](.kiro/steering/feature-status.md)** - ⭐ Source of truth
- **[Roadmap](.kiro/steering/roadmap.md)** - Path to v1.0.0
- **[Phase History](docs/phases/)** - What was completed when

### Development
- **[Development Guide](.kiro/steering/development-guide.md)** - How to develop
- **[Tech Stack](.kiro/steering/tech.md)** - Technologies used
- **[Testing Guide](.kiro/steering/testing.md)** - How to test

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

### ✅ Fully Functional (19 Modules)

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
- [x] Batch/Lot Tracking (Complete with expiry alerts)
- [x] Serial Number Tracking (Complete with warranty management)
- [x] Stock Transfers (Complete with workflow)
- [x] Email Notifications (Complete with 7 templates & scheduled jobs)

### 🔶 Infrastructure Only (Not Yet Functional)
- [ ] Multi-warehouse Support (database exists, needs entity & service integration - 2-3 weeks)

### 🚀 Planned Features
- [ ] Complete Multi-warehouse Support (Entity, Service, UI - 2-3 weeks)
- [ ] Financial Statements (P&L, Balance Sheet - 2 weeks)
- [ ] Automatic Journal Entries from Transactions (2 weeks)
- [ ] Barcode Scanning Integration (2-3 weeks)
- [ ] Mobile Optimization (4-6 weeks)
- [ ] Multi-tenancy Support (4-6 weeks)
- [ ] Advanced Analytics with ML (6-8 weeks)
- [ ] Manufacturing Module (MRP - 8-12 weeks)
- [ ] HR Management Module (6-8 weeks)

**See `.kiro/steering/feature-status.md` for detailed status of each feature**

See `.kiro/steering/recovery-plan.md` for complete roadmap.

## 🐛 Troubleshooting

See `docs/guides/TROUBLESHOOTING.md` for common issues and solutions.

## 📄 License

**Business Source License 1.1**

- **Licensor**: Mula Solution & Enterprise
- **Licensed Work**: Mula ERP
- **Change Date**: 2029-01-19 (4 years from release)
- **Change License**: GNU General Public License v3.0 or later

### License Summary

- ✅ **Non-production use**: Free for development, testing, and evaluation
- ✅ **Educational & Non-profit**: Free for educational institutions and non-profit organizations
- ⚠️ **Production use**: Requires a commercial license from Mula Solution & Enterprise
- 🔓 **After Change Date**: Automatically converts to GPL v3.0 or later on 2029-01-19

For full license terms, see the [LICENSE](LICENSE) file.

### Why BSL 1.1?

The Business Source License allows us to:
- Keep the source code open and transparent
- Support the open-source community with free non-production use
- Ensure sustainable development through commercial licensing
- Guarantee the software becomes fully open source after 4 years

### Commercial Licensing

For production use, please contact: **Mula Solution & Enterprise**

See [LICENSE](LICENSE) for complete terms and conditions.

## 🙏 Acknowledgments

Inspired by [Odoo](https://github.com/odoo/odoo) and [ERPNext](https://github.com/frappe/erpnext)

---

**Built with ❤️ using modern open-source technologies**
