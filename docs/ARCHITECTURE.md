# Mula ERP Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Technology Stack](#technology-stack)
4. [System Components](#system-components)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Design](#api-design)
8. [Security Architecture](#security-architecture)
9. [Performance Optimization](#performance-optimization)
10. [Scalability Considerations](#scalability-considerations)

---

## System Overview

Mula ERP is a full-featured Enterprise Resource Planning system built with modern web technologies. The system follows a microservices-inspired architecture with clear separation between frontend, backend, and data layers.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│                    (React SPA - Browser)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/HTTP
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx Reverse Proxy                     │
│              (Load Balancing, SSL Termination)               │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             │ Static Files                   │ /api/*
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│   Frontend Service     │      │    Backend Service         │
│   (React + Vite)       │      │   (Spring Boot + Java)     │
│   Port: 5173           │      │   Port: 8080               │
└────────────────────────┘      └──────────┬─────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
         ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
         │   PostgreSQL     │  │   Valkey/Redis   │  │   File Storage   │
         │   (Database)     │  │     (Cache)      │  │   (Backups)      │
         │   Port: 5432     │  │   Port: 6379     │  │                  │
         └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Key Characteristics

- **Monorepo Structure** - All services in single repository
- **Containerized** - Docker-based deployment
- **RESTful API** - Standard HTTP/JSON communication
- **JWT Authentication** - Stateless authentication
- **Responsive UI** - Mobile-friendly interface
- **Real-time Updates** - WebSocket support (future)

---

## Architecture Patterns

### 1. Layered Architecture (Backend)

```
┌─────────────────────────────────────────┐
│         Controller Layer                │
│  (REST endpoints, request validation)   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Service Layer                  │
│  (Business logic, transactions)         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Repository Layer                 │
│  (Data access, JPA repositories)        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Database Layer                 │
│  (PostgreSQL, persistence)              │
└─────────────────────────────────────────┘
```

**Benefits:**
- Clear separation of concerns
- Easy to test each layer independently
- Maintainable and scalable
- Standard Spring Boot pattern

### 2. Component-Based Architecture (Frontend)

```
┌─────────────────────────────────────────┐
│            App Component                │
│  (Routing, global state, providers)     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Page Components                │
│  (Dashboard, Products, Orders, etc.)    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Feature Components               │
│  (Forms, tables, charts, etc.)          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          UI Components                  │
│  (Buttons, inputs, modals, etc.)        │
└─────────────────────────────────────────┘
```

**Benefits:**
- Reusable components
- Easy to maintain and extend
- Clear component hierarchy
- Standard React pattern

### 3. Repository Pattern

All data access goes through JPA repositories:

```java
@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    Page<Product> findByDeletedFalse(Pageable pageable);
    Optional<Product> findBySkuAndDeletedFalse(String sku);
}
```

**Benefits:**
- Abstraction over data access
- Easy to mock for testing
- Consistent query patterns
- Built-in pagination and sorting

### 4. DTO Pattern

Data Transfer Objects separate internal entities from API contracts:

```java
// Internal Entity
@Entity
public class Product { ... }

// API DTO
public class ProductDto { ... }

// Request DTO
public class CreateProductRequest { ... }
```

**Benefits:**
- API stability (internal changes don't affect API)
- Validation at API boundary
- Security (don't expose internal structure)
- Flexibility in API design

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool |
| React Router | 6.x | Routing |
| Tailwind CSS | 3.x | Styling |
| Axios | 1.x | HTTP client |
| Lucide React | Latest | Icons |
| React Hook Form | 7.x | Form handling |
| Recharts | 2.x | Charts |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 17 | Programming language |
| Spring Boot | 3.2.x | Application framework |
| Spring Security | 6.x | Authentication/Authorization |
| Spring Data JPA | 3.x | Data access |
| Hibernate | 6.x | ORM |
| Flyway | 9.x | Database migrations |
| JWT (jjwt) | 0.12.x | Token generation |
| Lombok | Latest | Boilerplate reduction |
| Bucket4j | 8.x | Rate limiting |
| Springdoc OpenAPI | 2.3.x | API documentation |

### Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 16 | Primary database |
| Valkey | 7.2 | Cache (Redis fork) |
| Nginx | Latest | Reverse proxy |
| Docker | 24.x | Containerization |
| Docker Compose | 2.x | Orchestration |

---

## System Components

### 1. Frontend Service

**Responsibilities:**
- User interface rendering
- Client-side routing
- Form validation
- State management
- API communication
- User authentication (token storage)

**Key Features:**
- Lazy loading for performance
- Code splitting
- Responsive design
- Accessibility compliance
- Error boundaries

**Directory Structure:**
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components
│   ├── contexts/       # React contexts
│   ├── lib/            # Utilities (API client)
│   ├── types/          # TypeScript types
│   └── App.tsx         # Main app component
├── public/             # Static assets
└── tests/              # E2E tests
```

### 2. Backend Service

**Responsibilities:**
- Business logic execution
- Data validation
- Database operations
- Authentication/Authorization
- API endpoints
- Background jobs

**Key Features:**
- RESTful API
- JWT authentication
- Role-based access control
- Audit logging
- Rate limiting
- Caching

**Directory Structure:**
```
backend/
└── src/main/java/com/mulaerp/
    ├── auth/           # Authentication module
    ├── product/        # Product management
    ├── customer/       # Customer management
    ├── supplier/       # Supplier management
    ├── sales/          # Sales orders
    ├── reports/        # Reporting
    ├── analytics/      # Analytics
    ├── notifications/  # Notifications
    ├── audit/          # Audit logging
    └── common/         # Shared components
```

### 3. Database Service (PostgreSQL)

**Responsibilities:**
- Data persistence
- Transaction management
- Data integrity
- Query optimization

**Key Features:**
- ACID compliance
- Foreign key constraints
- Indexes for performance
- Automated backups
- Point-in-time recovery

### 4. Cache Service (Valkey/Redis)

**Responsibilities:**
- Application caching
- Session storage (future)
- Rate limiting data
- Temporary data storage

**Key Features:**
- In-memory storage
- TTL support
- Persistence (AOF)
- High performance

### 5. Reverse Proxy (Nginx)

**Responsibilities:**
- Request routing
- SSL termination
- Static file serving
- Load balancing (future)

**Key Features:**
- HTTP/2 support
- Gzip compression
- Security headers
- Access logging

---

## Data Flow

### 1. User Authentication Flow

```
User → Frontend → Backend → Database
  1. User enters credentials
  2. Frontend sends POST /api/v1/auth/login
  3. Backend validates credentials
  4. Backend generates JWT token
  5. Backend returns token + user info
  6. Frontend stores token in memory
  7. Frontend redirects to dashboard
```

### 2. API Request Flow (Authenticated)

```
User → Frontend → Nginx → Backend → Cache/Database
  1. User performs action
  2. Frontend sends request with JWT in header
  3. Nginx routes to backend
  4. Backend validates JWT
  5. Backend checks cache (if applicable)
  6. Backend queries database (if cache miss)
  7. Backend updates cache
  8. Backend returns response
  9. Frontend updates UI
```

### 3. Create Entity Flow

```
User → Frontend → Backend → Database → Audit Log
  1. User fills form
  2. Frontend validates input
  3. Frontend sends POST request
  4. Backend validates DTO
  5. Backend checks business rules
  6. Backend saves to database
  7. Backend clears cache
  8. Backend logs audit entry
  9. Backend returns created entity
  10. Frontend shows success message
```

---

## Database Schema

### Core Tables

#### Users & Authentication
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### Products
```sql
products (
  id UUID PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  unit_price DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) NOT NULL,
  stock_quantity INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### Sales Orders
```sql
sales_orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  order_date DATE NOT NULL,
  delivery_date DATE,
  status VARCHAR(50) NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  tax DECIMAL(15,2) NOT NULL,
  total DECIMAL(15,2) NOT NULL,
  notes TEXT,
  deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

sales_order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES sales_orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL
)
```

### Relationships

- **One-to-Many**: Customer → Sales Orders
- **One-to-Many**: Sales Order → Order Items
- **Many-to-One**: Product → Category
- **One-to-Many**: User → Audit Logs

### Indexes

Performance indexes on:
- Foreign keys
- Frequently queried columns (email, sku, order_number)
- Status fields
- Date fields
- Composite indexes for common queries

---

## API Design

### RESTful Principles

- **Resource-based URLs**: `/api/v1/products`, `/api/v1/customers`
- **HTTP methods**: GET (read), POST (create), PUT (update), DELETE (delete)
- **Status codes**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
- **JSON format**: All requests and responses use JSON

### API Versioning

- URL-based versioning: `/api/v1/`
- Allows backward compatibility
- Future versions: `/api/v2/`

### Pagination

```json
GET /api/v1/products?page=0&size=20&sort=name,asc

Response:
{
  "content": [...],
  "totalElements": 100,
  "totalPages": 5,
  "size": 20,
  "number": 0
}
```

### Error Handling

```json
{
  "timestamp": "2025-01-19T10:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "path": "/api/v1/products"
}
```

### Authentication

```
Authorization: Bearer <JWT_TOKEN>
```

### API Documentation

- Swagger UI: `/swagger-ui.html`
- OpenAPI spec: `/v3/api-docs`

---

## Security Architecture

### 1. Authentication

- **JWT tokens** for stateless authentication
- **BCrypt** password hashing
- **Token expiration** (24 hours default)
- **Refresh tokens** (future enhancement)

### 2. Authorization

- **Role-based access control** (RBAC)
- **Method-level security** with `@PreAuthorize`
- **Resource-level permissions** (future)

### 3. Input Validation

- **DTO validation** with Bean Validation
- **SQL injection prevention** via JPA
- **XSS prevention** via React (automatic escaping)

### 4. Rate Limiting

- **100 requests per minute** per IP
- **Bucket4j** implementation
- **Configurable limits** per endpoint (future)

### 5. Security Headers

- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **Content-Security-Policy**: default-src 'self'

### 6. Audit Logging

- **All CRUD operations** logged
- **User tracking** (who did what)
- **IP address** and **user agent** captured
- **Async logging** for performance

---

## Performance Optimization

### 1. Database Optimization

- **Indexes** on frequently queried columns
- **Query optimization** with JPA
- **Connection pooling** (HikariCP)
- **Lazy loading** for relationships

### 2. Caching Strategy

```
Cache Hierarchy:
1. Redis cache (30 min TTL)
2. Database query
3. Update cache
```

**Cached entities:**
- Products (1 hour)
- Customers (1 hour)
- Categories (2 hours)
- Dashboard metrics (5 minutes)
- Reports (15 minutes)

### 3. Frontend Optimization

- **Code splitting** with React.lazy()
- **Lazy loading** routes
- **Image optimization**
- **Gzip compression** (Nginx)
- **CDN** for static assets (future)

### 4. API Optimization

- **Pagination** for large datasets
- **Field selection** (future)
- **Batch operations** (future)
- **GraphQL** consideration (future)

---

## Scalability Considerations

### Horizontal Scaling

**Current state:** Single instance
**Future:** Multiple instances behind load balancer

```
                    ┌─────────────┐
                    │   Nginx LB  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐        ┌─────────┐       ┌─────────┐
   │Backend 1│        │Backend 2│       │Backend 3│
   └─────────┘        └─────────┘       └─────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │   (Primary) │
                    └─────────────┘
```

### Database Scaling

**Options:**
1. **Read replicas** for read-heavy workloads
2. **Partitioning** by date or customer
3. **Sharding** for very large datasets
4. **Connection pooling** optimization

### Cache Scaling

**Options:**
1. **Redis Cluster** for high availability
2. **Redis Sentinel** for failover
3. **Separate cache per service** (future microservices)

### File Storage Scaling

**Options:**
1. **Object storage** (S3, MinIO)
2. **CDN** for static assets
3. **Distributed file system**

---

## Future Enhancements

### Short-term (3-6 months)
- WebSocket for real-time updates
- Advanced reporting with custom queries
- Email notifications
- File upload/download
- Multi-language support

### Medium-term (6-12 months)
- Mobile app (React Native)
- Advanced analytics with ML
- Workflow automation
- Integration APIs (REST webhooks)
- Multi-tenancy support

### Long-term (12+ months)
- Microservices architecture
- Event-driven architecture (Kafka)
- GraphQL API
- Advanced security (2FA, SSO)
- AI-powered insights

---

*Last Updated: Phase 5 - Production Ready*
*Version: 1.0.0*
