# Mula ERP Recovery & Implementation Plan

## Current State Assessment

### What Exists
- ✅ Docker Compose orchestration configuration
- ✅ Nginx reverse proxy configuration
- ✅ Environment variable templates
- ✅ Database and cache infrastructure setup
- ✅ Git submodule structure (but empty)
- ✅ Bolt AI configuration (React + Vite + TypeScript + Tailwind)

### What's Missing
- ❌ Frontend application code (React)
- ❌ Backend application code (Java Spring Boot)
- ❌ Middleware application code (Node.js)
- ❌ Database schema and migrations
- ❌ API endpoints and business logic
- ❌ Authentication and authorization implementation
- ❌ UI components and pages
- ❌ Integration with CAS system

### Problem Analysis
The project was started with Bolt AI but ran out of credits mid-development, leaving:
- Empty submodule directories
- Infrastructure configuration without application code
- Placeholder/hallucinated functionality references
- No actual ERP business logic

---

## Recovery Strategy

### Phase 0: Foundation Setup (Week 1)
**Goal**: Establish working development environment and project structure

#### 0.1 Repository Structure Decision
**Options**:
1. **Keep submodules** - Maintain separate repos (complex, matches current setup)
2. **Monorepo approach** - Move all code to root (simpler, better for development)

**Recommendation**: Convert to monorepo for faster development, easier debugging

#### 0.2 Technology Stack Validation
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- Backend: Java Spring Boot 3.x + PostgreSQL + Spring Data JPA
- Middleware: Node.js + Express (or consider removing if not needed)
- Cache: Valkey (Redis fork)
- Auth: JWT + Spring Security

#### 0.3 Development Environment Setup
- [ ] Initialize frontend with Vite + React + TypeScript
- [ ] Initialize backend with Spring Initializr
- [ ] Set up hot reload for both services
- [ ] Configure CORS properly
- [ ] Create development docker-compose override

---

## Phase 1: Core Infrastructure (Week 1-2)

### 1.1 Database Schema Design
**Reference**: Odoo and ERPNext schemas

#### Core Tables (Priority 1)
```sql
-- User Management
users (id, email, password_hash, full_name, role, status, created_at, updated_at)
roles (id, name, permissions, created_at)
user_roles (user_id, role_id)

-- Company/Organization
companies (id, name, tax_id, address, phone, email, currency, created_at)
branches (id, company_id, name, address, phone, manager_id)

-- Product/Inventory Management
product_categories (id, name, parent_id, description)
products (id, sku, name, description, category_id, unit_price, cost_price, stock_quantity, reorder_level, status)
warehouses (id, name, location, manager_id)
stock_movements (id, product_id, warehouse_id, quantity, type, reference, date, user_id)

-- Customer Management (CRM)
customers (id, name, email, phone, address, tax_id, credit_limit, status, created_at)
customer_contacts (id, customer_id, name, email, phone, position)

-- Supplier Management
suppliers (id, name, email, phone, address, tax_id, payment_terms, status)
supplier_contacts (id, supplier_id, name, email, phone, position)

-- Sales Management
sales_orders (id, order_number, customer_id, order_date, delivery_date, status, subtotal, tax, total, notes)
sales_order_items (id, order_id, product_id, quantity, unit_price, discount, tax_rate, total)

-- Purchase Management
purchase_orders (id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax, total)
purchase_order_items (id, po_id, product_id, quantity, unit_price, tax_rate, total)

-- Invoicing
invoices (id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax, total, paid_amount)
invoice_items (id, invoice_id, product_id, description, quantity, unit_price, tax_rate, total)

-- Payments
payments (id, payment_number, invoice_id, payment_date, amount, method, reference, status)

-- Accounting (Basic)
accounts (id, code, name, type, parent_id, balance)
journal_entries (id, entry_number, date, description, status)
journal_entry_lines (id, entry_id, account_id, debit, credit, description)
```

#### 1.2 Backend Core Setup
- [ ] Spring Boot project structure
- [ ] Database connection and JPA configuration
- [ ] Flyway/Liquibase migrations
- [ ] Base entity classes (with audit fields)
- [ ] Repository layer
- [ ] Service layer architecture
- [ ] Exception handling framework
- [ ] Logging configuration

#### 1.3 Authentication System
- [ ] JWT token generation and validation
- [ ] Spring Security configuration
- [ ] User registration endpoint
- [ ] Login endpoint
- [ ] Password hashing (BCrypt)
- [ ] Refresh token mechanism
- [ ] Role-based access control (RBAC)
- [ ] CAS integration (optional, can be Phase 3)

---

## Phase 2: Frontend Foundation (Week 2-3)

### 2.1 UI Framework Setup
- [ ] Tailwind CSS configuration
- [ ] Component library structure
- [ ] Routing (React Router v6)
- [ ] State management (Context API or Zustand)
- [ ] API client (Axios with interceptors)
- [ ] Form handling (React Hook Form)
- [ ] Toast notifications
- [ ] Loading states and error boundaries

### 2.2 Core UI Components
**Reference**: Odoo and ERPNext UI patterns

#### Layout Components
- [ ] AppLayout (sidebar + header + content)
- [ ] Sidebar navigation
- [ ] Header with user menu
- [ ] Breadcrumbs
- [ ] Page container

#### Form Components
- [ ] Input fields (text, number, email, etc.)
- [ ] Select/dropdown
- [ ] Date picker
- [ ] Checkbox and radio
- [ ] File upload
- [ ] Rich text editor (for descriptions)
- [ ] Form validation display

#### Data Display Components
- [ ] DataTable (sortable, filterable, paginated)
- [ ] Card component
- [ ] Badge/Status indicator
- [ ] Modal/Dialog
- [ ] Tabs
- [ ] Accordion

#### Business Components
- [ ] Product selector
- [ ] Customer selector
- [ ] Invoice line items editor
- [ ] Order line items editor

### 2.3 Authentication UI
- [ ] Login page
- [ ] Registration page (if needed)
- [ ] Forgot password
- [ ] Protected route wrapper
- [ ] Auth context/store

---

## Phase 3: Core ERP Modules (Week 3-6)

### 3.1 User & Company Management
**Backend**:
- [ ] User CRUD APIs
- [ ] Role management APIs
- [ ] Company/Branch CRUD APIs
- [ ] User profile APIs

**Frontend**:
- [ ] User list page
- [ ] User form (create/edit)
- [ ] Role management page
- [ ] Company settings page
- [ ] User profile page

### 3.2 Product & Inventory Module
**Backend**:
- [ ] Product CRUD APIs
- [ ] Category management APIs
- [ ] Stock movement APIs
- [ ] Warehouse management APIs
- [ ] Low stock alerts
- [ ] Product search and filtering

**Frontend**:
- [ ] Product list page (with search, filter)
- [ ] Product form (create/edit)
- [ ] Product detail view
- [ ] Category management
- [ ] Stock movement history
- [ ] Warehouse management
- [ ] Low stock dashboard widget

### 3.3 Customer Management (CRM)
**Backend**:
- [ ] Customer CRUD APIs
- [ ] Customer contact APIs
- [ ] Customer search and filtering
- [ ] Customer credit limit checking
- [ ] Customer transaction history

**Frontend**:
- [ ] Customer list page
- [ ] Customer form (create/edit)
- [ ] Customer detail view (with tabs)
- [ ] Customer contact management
- [ ] Customer transaction history view

### 3.4 Supplier Management
**Backend**:
- [ ] Supplier CRUD APIs
- [ ] Supplier contact APIs
- [ ] Supplier search and filtering
- [ ] Supplier transaction history

**Frontend**:
- [ ] Supplier list page
- [ ] Supplier form (create/edit)
- [ ] Supplier detail view
- [ ] Supplier contact management

### 3.5 Sales Management
**Backend**:
- [ ] Sales order CRUD APIs
- [ ] Order status workflow (draft → confirmed → delivered → invoiced)
- [ ] Order line items management
- [ ] Stock reservation on order confirmation
- [ ] Order search and filtering
- [ ] Sales reports

**Frontend**:
- [ ] Sales order list page
- [ ] Sales order form (with line items)
- [ ] Sales order detail view
- [ ] Order status management
- [ ] Sales dashboard
- [ ] Sales reports page

### 3.6 Purchase Management
**Backend**:
- [ ] Purchase order CRUD APIs
- [ ] PO status workflow (draft → sent → received → invoiced)
- [ ] PO line items management
- [ ] Stock receiving from PO
- [ ] PO search and filtering

**Frontend**:
- [ ] Purchase order list page
- [ ] Purchase order form
- [ ] Purchase order detail view
- [ ] Receiving management
- [ ] Purchase dashboard

### 3.7 Invoicing Module
**Backend**:
- [ ] Invoice CRUD APIs
- [ ] Invoice generation from sales orders
- [ ] Invoice status workflow (draft → sent → paid → cancelled)
- [ ] Invoice line items
- [ ] Tax calculation
- [ ] Invoice PDF generation
- [ ] Invoice search and filtering

**Frontend**:
- [ ] Invoice list page
- [ ] Invoice form
- [ ] Invoice detail view
- [ ] Invoice PDF preview
- [ ] Invoice email sending
- [ ] Overdue invoices dashboard

### 3.8 Payment Management
**Backend**:
- [ ] Payment CRUD APIs
- [ ] Payment allocation to invoices
- [ ] Payment methods management
- [ ] Payment reconciliation
- [ ] Payment reports

**Frontend**:
- [ ] Payment list page
- [ ] Payment form
- [ ] Payment allocation interface
- [ ] Payment history view

---

## Phase 4: Advanced Features (Week 7-8)

### 4.1 Dashboard & Analytics
- [ ] Sales dashboard (charts, KPIs)
- [ ] Inventory dashboard
- [ ] Financial dashboard
- [ ] Custom dashboard widgets
- [ ] Chart library integration (Recharts or Chart.js)

### 4.2 Reporting System
- [ ] Sales reports (by period, product, customer)
- [ ] Purchase reports
- [ ] Inventory reports (stock levels, movements)
- [ ] Financial reports (P&L, balance sheet basics)
- [ ] Aging reports (AR/AP)
- [ ] Export to Excel/PDF

### 4.3 Basic Accounting
- [ ] Chart of accounts management
- [ ] Journal entry creation
- [ ] Automatic journal entries from invoices/payments
- [ ] Trial balance
- [ ] Account ledger view

### 4.4 Search & Filtering
- [ ] Global search functionality
- [ ] Advanced filtering on all list pages
- [ ] Saved filters
- [ ] Quick filters

### 4.5 Notifications & Alerts
- [ ] Low stock alerts
- [ ] Overdue invoice notifications
- [ ] Order status change notifications
- [ ] System notifications
- [ ] Email notifications

---

## Phase 5: Polish & Production Ready (Week 9-10)

### 5.1 Performance Optimization
- [ ] Database indexing
- [ ] Query optimization
- [ ] Redis caching implementation
- [ ] Frontend code splitting
- [ ] Lazy loading routes
- [ ] Image optimization
- [ ] API response caching

### 5.2 Security Hardening
- [ ] Input validation (backend)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] SQL injection prevention
- [ ] Rate limiting
- [ ] Security headers
- [ ] Audit logging

### 5.3 Testing
- [ ] Backend unit tests (critical business logic)
- [ ] Backend integration tests
- [ ] Frontend component tests
- [ ] E2E tests (critical flows)
- [ ] API documentation (Swagger/OpenAPI)

### 5.4 DevOps & Deployment
- [ ] Production Dockerfiles
- [ ] Environment-specific configs
- [ ] Database backup automation
- [ ] Monitoring setup
- [ ] Error tracking (Sentry or similar)
- [ ] CI/CD pipeline
- [ ] SSL certificate setup

### 5.5 Documentation
- [ ] User manual
- [ ] API documentation
- [ ] Deployment guide
- [ ] Developer setup guide
- [ ] Architecture documentation

---

## Phase 6: Optional Enhancements (Week 11+)

### 6.1 Advanced Inventory
- [ ] Multi-warehouse support
- [ ] Batch/lot tracking
- [ ] Serial number tracking
- [ ] Barcode scanning
- [ ] Stock adjustments
- [ ] Inventory valuation methods

### 6.2 Manufacturing (Basic MRP)
- [ ] Bill of materials (BOM)
- [ ] Work orders
- [ ] Production planning
- [ ] Material requirements planning

### 6.3 HR Management (Basic)
- [ ] Employee management
- [ ] Attendance tracking
- [ ] Leave management
- [ ] Payroll (basic)

### 6.4 Project Management
- [ ] Project tracking
- [ ] Task management
- [ ] Time tracking
- [ ] Project costing

### 6.5 Multi-tenancy
- [ ] Tenant isolation
- [ ] Tenant-specific databases
- [ ] Tenant management UI

### 6.6 Mobile App
- [ ] React Native app
- [ ] Mobile-optimized web UI
- [ ] Offline support

---

## Implementation Priorities

### Must Have (MVP - Weeks 1-6)
1. Authentication & User Management
2. Product & Inventory Management
3. Customer Management
4. Sales Orders
5. Invoicing
6. Basic Dashboard

### Should Have (Weeks 7-8)
1. Purchase Orders
2. Supplier Management
3. Payment Management
4. Reports
5. Notifications

### Nice to Have (Weeks 9-10)
1. Basic Accounting
2. Advanced Analytics
3. Performance Optimization
4. Comprehensive Testing

### Future Enhancements (Week 11+)
1. Advanced Inventory Features
2. Manufacturing Module
3. HR Module
4. Mobile App

---

## Technical Decisions & Best Practices

### Backend Architecture
- **Pattern**: Layered architecture (Controller → Service → Repository)
- **DTOs**: Use separate DTOs for requests/responses
- **Validation**: Bean Validation (JSR-380)
- **Error Handling**: Global exception handler
- **API Versioning**: URL-based (/api/v1/)
- **Documentation**: Swagger/OpenAPI

### Frontend Architecture
- **Pattern**: Feature-based folder structure
- **State**: Context API for auth, local state for forms
- **API Calls**: Centralized API client with interceptors
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS with custom components
- **Icons**: Lucide React

### Database Design Principles
- Use UUIDs for primary keys (better for distributed systems)
- Soft deletes (deleted_at column)
- Audit fields (created_at, updated_at, created_by, updated_by)
- Proper foreign key constraints
- Indexes on frequently queried columns
- Normalized design (3NF minimum)

### Code Quality
- **Backend**: Checkstyle, SpotBugs, JaCoCo
- **Frontend**: ESLint, Prettier
- **Git**: Conventional commits
- **Code Review**: Required for all PRs
- **Testing**: Minimum 70% coverage for business logic

---

## Reference Implementation Sources

### Odoo (Python/PostgreSQL)
- **Study**: Module structure, workflow patterns, UI/UX
- **Copy**: Database schema concepts, business logic patterns
- **URL**: https://github.com/odoo/odoo

### ERPNext (Python/MariaDB)
- **Study**: DocType structure, permissions, reports
- **Copy**: Accounting logic, inventory management patterns
- **URL**: https://github.com/frappe/erpnext

### What to Copy
1. **Database schemas** - Table structures and relationships
2. **Business logic** - Calculation methods, workflows
3. **UI patterns** - Form layouts, list views, dashboards
4. **Report templates** - Standard business reports
5. **Validation rules** - Business rule validations

### What NOT to Copy
- Exact code (different languages/frameworks)
- Framework-specific implementations
- Licensing issues (use as reference only)

---

## Risk Mitigation

### Technical Risks
1. **Risk**: Complex business logic
   - **Mitigation**: Start simple, iterate, reference Odoo/ERPNext
   
2. **Risk**: Performance issues with large datasets
   - **Mitigation**: Proper indexing, pagination, caching from start
   
3. **Risk**: Security vulnerabilities
   - **Mitigation**: Follow OWASP guidelines, security review

### Project Risks
1. **Risk**: Scope creep
   - **Mitigation**: Strict MVP definition, phase-based approach
   
2. **Risk**: Time overruns
   - **Mitigation**: Weekly milestones, adjust scope if needed
   
3. **Risk**: Integration issues
   - **Mitigation**: Early integration testing, CI/CD pipeline

---

## Success Metrics

### Week 2
- [ ] User can login
- [ ] Database schema created
- [ ] Basic CRUD for one entity working

### Week 4
- [ ] Product management working
- [ ] Customer management working
- [ ] Basic dashboard visible

### Week 6 (MVP)
- [ ] Can create sales order
- [ ] Can generate invoice
- [ ] Can record payment
- [ ] Basic reports working

### Week 8
- [ ] All core modules functional
- [ ] Reports and analytics working
- [ ] System usable for basic ERP operations

### Week 10 (Production Ready)
- [ ] Performance optimized
- [ ] Security hardened
- [ ] Tests passing
- [ ] Documentation complete
- [ ] Ready for deployment

---

## Next Steps

1. **Immediate** (Today):
   - Review and approve this plan
   - Decide on monorepo vs submodules
   - Set up development environment
   
2. **This Week**:
   - Initialize frontend project
   - Initialize backend project
   - Create database schema
   - Implement authentication
   
3. **Next Week**:
   - First CRUD module (Products)
   - Basic UI components
   - Integration testing

---

## Resources Needed

### Development Tools
- IDE: IntelliJ IDEA (backend), VS Code (frontend)
- Database: PostgreSQL client (DBeaver, pgAdmin)
- API Testing: Postman or Insomnia
- Git client

### External Services (Optional)
- Email service (SendGrid, AWS SES)
- File storage (AWS S3, MinIO)
- Error tracking (Sentry)
- Analytics (Plausible, Umami)

### Documentation
- Odoo documentation
- ERPNext documentation
- Spring Boot documentation
- React documentation
- Tailwind CSS documentation
