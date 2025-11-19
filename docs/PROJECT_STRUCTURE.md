# Project Structure - Organized with 5S Principles

## Root Directory (Clean & Essential)

```
enterprise-resource-planning/
├── README.md              # Main documentation
├── compose.yaml           # Docker Compose orchestration
├── .env                   # Environment variables (gitignored)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
│
├── frontend/              # React application
├── backend/               # Spring Boot application
│
├── docs/                  # 📚 All documentation
├── scripts/               # 🔧 All scripts
├── docker/                # 🐳 Docker configurations
│
├── logs/                  # Application logs (gitignored)
├── postgres_data/         # Database data (gitignored)
├── postgres_backups/      # Database backups (gitignored)
└── valkey_data/          # Cache data (gitignored)
```

## Documentation Structure (`docs/`)

```
docs/
├── phases/                # Phase completion documents
│   ├── PHASE_0_COMPLETE.md
│   ├── PHASE_1_COMPLETE.md
│   ├── PHASE_2_COMPLETE.md
│   ├── PHASE_2_COMPONENTS.md
│   ├── PHASE_2_FINAL.md
│   └── PHASE_3_COMPLETE.md
│
├── guides/                # Development and tracking guides
│   ├── CURRENT_STATUS.md          # Overall project status
│   ├── PHASE_TRACKING.md          # Detailed progress tracking
│   ├── ACTUAL_VS_PLANNED.md       # Plan vs reality comparison
│   ├── REFACTORING_COMPLETE.md    # Refactoring summary
│   ├── REFACTORING_EXAMPLE.md     # Refactoring patterns
│   ├── UI_IMPROVEMENTS.md         # UI design documentation
│   ├── TROUBLESHOOTING.md         # Common issues
│   ├── SUCCESS.md                 # Success stories
│   └── VALIDATION_RESULTS.md      # Test results
│
└── PROJECT_STRUCTURE.md   # This file
```

## Scripts Structure (`scripts/`)

```
scripts/
├── start-dev.sh           # Start development environment
├── start.sh               # Start production environment
├── validate-phases.sh     # Validate all implemented phases
├── test-phase1.sh         # Test Phase 1 features
├── test-phase3.sh         # Test Phase 3 features
├── verify.sh              # Quick verification script
└── create-admin-user.sh   # Create admin user
```

## Docker Structure (`docker/`)

```
docker/
├── nginx/                 # Nginx reverse proxy
│   └── nginx.conf        # Nginx configuration
├── init-scripts/          # Database initialization scripts
└── docker-compose.dev.yml # Development overrides
```

## Application Structure

### Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI components (14 components)
│   │   ├── business/    # Business-specific components
│   │   └── Layout.tsx   # Main layout
│   ├── pages/           # Page components
│   │   ├── auth/        # Authentication pages
│   │   ├── dashboard/   # Dashboard
│   │   ├── products/    # Product management
│   │   ├── customers/   # Customer management
│   │   ├── suppliers/   # Supplier management
│   │   └── sales/       # Sales order management
│   ├── contexts/        # React contexts (Auth)
│   ├── lib/             # Utilities (API client)
│   └── index.css        # Tailwind CSS v4 configuration
├── Dockerfile           # Frontend Docker image
└── package.json         # Dependencies
```

### Backend (`backend/`)
```
backend/
├── src/main/java/com/mulaerp/
│   ├── auth/            # Authentication module
│   ├── product/         # Product management
│   ├── customer/        # Customer management
│   ├── supplier/        # Supplier management
│   ├── sales/           # Sales order management
│   └── common/          # Shared components
├── src/main/resources/
│   ├── db/migration/    # Flyway migrations
│   └── application.yml  # Configuration
├── Dockerfile           # Backend Docker image
└── pom.xml              # Maven dependencies
```

## 5S Principles Applied

### 1. Sort (Seiri) - Separate Needed from Unneeded
- ✅ Moved all documentation to `docs/`
- ✅ Moved all scripts to `scripts/`
- ✅ Moved Docker configs to `docker/`
- ✅ Kept only essentials in root

### 2. Set in Order (Seiton) - A Place for Everything
- ✅ Phase docs in `docs/phases/`
- ✅ Guides in `docs/guides/`
- ✅ Scripts in `scripts/`
- ✅ Docker configs in `docker/`

### 3. Shine (Seiso) - Clean and Organized
- ✅ Root directory is clean (only 5 essential files)
- ✅ Clear folder names
- ✅ Logical grouping
- ✅ Easy to navigate

### 4. Standardize (Seiketsu) - Maintain Standards
- ✅ Consistent naming conventions
- ✅ Clear folder purposes
- ✅ Documentation structure
- ✅ Script naming patterns

### 5. Sustain (Shitsuke) - Keep it Up
- ✅ Clear structure documented
- ✅ Easy to maintain
- ✅ New files have obvious homes
- ✅ README guides to all resources

## Benefits

### Before Organization
- 30+ files in root directory
- Hard to find documentation
- Scripts mixed with docs
- Cluttered and confusing

### After Organization
- 5 essential files in root
- Clear folder structure
- Easy to find anything
- Professional and clean

## Quick Reference

### Find Documentation
```bash
ls docs/phases/          # Phase completion docs
ls docs/guides/          # Development guides
ls .kiro/steering/       # Project guidelines
```

### Run Scripts
```bash
./scripts/validate-phases.sh    # Validate all phases
./scripts/test-phase3.sh        # Test Phase 3
./scripts/start-dev.sh          # Start development
```

### Docker Configs
```bash
ls docker/nginx/         # Nginx configuration
ls docker/init-scripts/  # Database init scripts
```

## Navigation Guide

| Need to... | Go to... |
|------------|----------|
| Start the app | `docker compose up` |
| Read phase docs | `docs/phases/` |
| Check progress | `docs/guides/CURRENT_STATUS.md` |
| Run tests | `./scripts/validate-phases.sh` |
| See guidelines | `.kiro/steering/` |
| Configure Docker | `docker/` |
| View API code | `backend/src/` |
| View UI code | `frontend/src/` |

## Conclusion

The project is now organized following 5S principles with:
- ✅ Clean root directory (5 essential files)
- ✅ Logical folder structure
- ✅ Easy navigation
- ✅ Professional organization
- ✅ Maintainable structure

**Everything has its place, and everything is in its place!** 📦✨
