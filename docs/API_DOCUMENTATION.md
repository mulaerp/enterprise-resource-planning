# Mula ERP API Documentation

## Overview

The Mula ERP API is a RESTful API that provides access to all ERP functionality. All endpoints return JSON and require authentication (except auth endpoints).

**Base URL:** `http://localhost:8080/api/v1`  
**Interactive Documentation:** `http://localhost:8080/swagger-ui.html`  
**OpenAPI Spec:** `http://localhost:8080/v3/api-docs`

---

## Authentication

### Login

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "admin@mulaerp.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@mulaerp.com",
    "fullName": "System Administrator",
    "role": "ADMIN"
  }
}
```

### Get Current User

**Endpoint:** `GET /auth/me`  
**Auth Required:** Yes

**Response:**
```json
{
  "id": "uuid",
  "email": "admin@mulaerp.com",
  "fullName": "System Administrator",
  "role": "ADMIN"
}
```

---

## Products

### List Products

**Endpoint:** `GET /products`  
**Auth Required:** Yes

**Query Parameters:**
- `page` (optional): Page number (default: 0)
- `size` (optional): Page size (default: 20)
- `sort` (optional): Sort field and direction (e.g., `name,asc`)

**Response:**
```json
{
  "content": [
    {
      "id": "uuid",
      "sku": "PROD-001",
      "name": "Product Name",
      "description": "Product description",
      "categoryId": "uuid",
      "categoryName": "Category Name",
      "unitPrice": 100.00,
      "costPrice": 50.00,
      "stockQuantity": 100,
      "reorderLevel": 10,
      "status": "ACTIVE",
      "createdAt": "2025-01-19T10:00:00",
      "updatedAt": "2025-01-19T10:00:00"
    }
  ],
  "totalElements": 100,
  "totalPages": 5,
  "size": 20,
  "number": 0
}
```

### Get Product by ID

**Endpoint:** `GET /products/{id}`  
**Auth Required:** Yes

**Response:**
```json
{
  "id": "uuid",
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "categoryId": "uuid",
  "categoryName": "Category Name",
  "unitPrice": 100.00,
  "costPrice": 50.00,
  "stockQuantity": 100,
  "reorderLevel": 10,
  "status": "ACTIVE",
  "createdAt": "2025-01-19T10:00:00",
  "updatedAt": "2025-01-19T10:00:00"
}
```

### Create Product

**Endpoint:** `POST /products`  
**Auth Required:** Yes

**Request:**
```json
{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "categoryId": "uuid",
  "unitPrice": 100.00,
  "costPrice": 50.00,
  "stockQuantity": 100,
  "reorderLevel": 10,
  "status": "ACTIVE"
}
```

**Response:** Same as Get Product

### Update Product

**Endpoint:** `PUT /products/{id}`  
**Auth Required:** Yes

**Request:** Same as Create Product (without SKU)

**Response:** Same as Get Product

### Delete Product

**Endpoint:** `DELETE /products/{id}`  
**Auth Required:** Yes

**Response:** `204 No Content`

### Search Products

**Endpoint:** `GET /products/search`  
**Auth Required:** Yes

**Query Parameters:**
- `q` (required): Search query
- `page`, `size`, `sort` (optional)

**Response:** Same as List Products

### Get Low Stock Products

**Endpoint:** `GET /products/low-stock`  
**Auth Required:** Yes

**Response:** Same as List Products

### Get Product Categories

**Endpoint:** `GET /products/categories`  
**Auth Required:** Yes

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Category Name",
    "description": "Category description",
    "parentId": "uuid",
    "parentName": "Parent Category",
    "createdAt": "2025-01-19T10:00:00",
    "updatedAt": "2025-01-19T10:00:00"
  }
]
```

---

## Customers

### List Customers

**Endpoint:** `GET /customers`  
**Auth Required:** Yes

**Query Parameters:** Same as Products

**Response:**
```json
{
  "content": [
    {
      "id": "uuid",
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+1234567890",
      "address": "123 Main St",
      "taxId": "TAX123",
      "creditLimit": 10000.00,
      "status": "ACTIVE",
      "createdAt": "2025-01-19T10:00:00",
      "updatedAt": "2025-01-19T10:00:00"
    }
  ],
  "totalElements": 50,
  "totalPages": 3,
  "size": 20,
  "number": 0
}
```

### Get Customer by ID

**Endpoint:** `GET /customers/{id}`  
**Auth Required:** Yes

### Create Customer

**Endpoint:** `POST /customers`  
**Auth Required:** Yes

**Request:**
```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "taxId": "TAX123",
  "creditLimit": 10000.00,
  "status": "ACTIVE"
}
```

### Update Customer

**Endpoint:** `PUT /customers/{id}`  
**Auth Required:** Yes

### Delete Customer

**Endpoint:** `DELETE /customers/{id}`  
**Auth Required:** Yes

### Search Customers

**Endpoint:** `GET /customers/search`  
**Auth Required:** Yes

---

## Suppliers

### List Suppliers

**Endpoint:** `GET /suppliers`  
**Auth Required:** Yes

**Response:**
```json
{
  "content": [
    {
      "id": "uuid",
      "name": "Supplier Name",
      "email": "supplier@example.com",
      "phone": "+1234567890",
      "address": "456 Supplier St",
      "taxId": "TAX456",
      "paymentTerms": "Net 30",
      "status": "ACTIVE",
      "createdAt": "2025-01-19T10:00:00",
      "updatedAt": "2025-01-19T10:00:00"
    }
  ],
  "totalElements": 30,
  "totalPages": 2,
  "size": 20,
  "number": 0
}
```

### Get Supplier by ID

**Endpoint:** `GET /suppliers/{id}`  
**Auth Required:** Yes

### Create Supplier

**Endpoint:** `POST /suppliers`  
**Auth Required:** Yes

**Request:**
```json
{
  "name": "Supplier Name",
  "email": "supplier@example.com",
  "phone": "+1234567890",
  "address": "456 Supplier St",
  "taxId": "TAX456",
  "paymentTerms": "Net 30",
  "status": "ACTIVE"
}
```

### Update Supplier

**Endpoint:** `PUT /suppliers/{id}`  
**Auth Required:** Yes

### Delete Supplier

**Endpoint:** `DELETE /suppliers/{id}`  
**Auth Required:** Yes

### Search Suppliers

**Endpoint:** `GET /suppliers/search`  
**Auth Required:** Yes

---

## Sales Orders

### List Sales Orders

**Endpoint:** `GET /sales-orders`  
**Auth Required:** Yes

**Response:**
```json
{
  "content": [
    {
      "id": "uuid",
      "orderNumber": "SO-2025-001",
      "customerId": "uuid",
      "customerName": "Customer Name",
      "orderDate": "2025-01-19",
      "deliveryDate": "2025-01-26",
      "status": "CONFIRMED",
      "subtotal": 1000.00,
      "tax": 100.00,
      "total": 1100.00,
      "notes": "Special instructions",
      "createdAt": "2025-01-19T10:00:00",
      "updatedAt": "2025-01-19T10:00:00"
    }
  ],
  "totalElements": 200,
  "totalPages": 10,
  "size": 20,
  "number": 0
}
```

### Get Sales Order by ID

**Endpoint:** `GET /sales-orders/{id}`  
**Auth Required:** Yes

**Response:**
```json
{
  "id": "uuid",
  "orderNumber": "SO-2025-001",
  "customerId": "uuid",
  "customerName": "Customer Name",
  "orderDate": "2025-01-19",
  "deliveryDate": "2025-01-26",
  "status": "CONFIRMED",
  "subtotal": 1000.00,
  "tax": 100.00,
  "total": 1100.00,
  "notes": "Special instructions",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Product Name",
      "productSku": "PROD-001",
      "quantity": 10,
      "unitPrice": 100.00,
      "discount": 0.00,
      "taxRate": 10.00,
      "total": 1100.00
    }
  ],
  "createdAt": "2025-01-19T10:00:00",
  "updatedAt": "2025-01-19T10:00:00"
}
```

### Create Sales Order

**Endpoint:** `POST /sales-orders`  
**Auth Required:** Yes

**Request:**
```json
{
  "customerId": "uuid",
  "orderDate": "2025-01-19",
  "deliveryDate": "2025-01-26",
  "status": "DRAFT",
  "notes": "Special instructions",
  "items": [
    {
      "productId": "uuid",
      "quantity": 10,
      "unitPrice": 100.00,
      "discount": 0.00,
      "taxRate": 10.00
    }
  ]
}
```

### Update Sales Order

**Endpoint:** `PUT /sales-orders/{id}`  
**Auth Required:** Yes

### Update Sales Order Status

**Endpoint:** `PATCH /sales-orders/{id}/status`  
**Auth Required:** Yes

**Request:**
```json
{
  "status": "CONFIRMED"
}
```

### Delete Sales Order

**Endpoint:** `DELETE /sales-orders/{id}`  
**Auth Required:** Yes

---

## Reports

### Get Sales Report

**Endpoint:** `GET /reports/sales`  
**Auth Required:** Yes

**Query Parameters:**
- `startDate` (required): Start date (YYYY-MM-DD)
- `endDate` (required): End date (YYYY-MM-DD)

**Response:**
```json
{
  "totalSales": 50000.00,
  "totalOrders": 100,
  "averageOrderValue": 500.00,
  "topProducts": [
    {
      "productId": "uuid",
      "productName": "Product Name",
      "quantity": 500,
      "revenue": 25000.00
    }
  ],
  "topCustomers": [
    {
      "customerId": "uuid",
      "customerName": "Customer Name",
      "orderCount": 20,
      "totalSpent": 10000.00
    }
  ],
  "salesByDate": [
    {
      "date": "2025-01-19",
      "sales": 1000.00,
      "orders": 5
    }
  ]
}
```

### Get Inventory Report

**Endpoint:** `GET /reports/inventory`  
**Auth Required:** Yes

**Response:**
```json
{
  "totalProducts": 500,
  "totalStockValue": 250000.00,
  "lowStockItems": 25,
  "outOfStockItems": 5,
  "products": [
    {
      "productId": "uuid",
      "productName": "Product Name",
      "sku": "PROD-001",
      "stockQuantity": 100,
      "reorderLevel": 10,
      "stockValue": 5000.00,
      "status": "ACTIVE"
    }
  ]
}
```

---

## Analytics

### Get Dashboard Metrics

**Endpoint:** `GET /analytics/dashboard`  
**Auth Required:** Yes

**Response:**
```json
{
  "totalRevenue": 100000.00,
  "totalOrders": 500,
  "totalCustomers": 150,
  "lowStockItems": 25,
  "recentOrders": [...],
  "salesTrend": [...],
  "topProducts": [...]
}
```

---

## Notifications

### Get User Notifications

**Endpoint:** `GET /notifications`  
**Auth Required:** Yes

**Query Parameters:**
- `page`, `size` (optional)

**Response:**
```json
{
  "content": [
    {
      "id": "uuid",
      "type": "LOW_STOCK",
      "title": "Low Stock Alert",
      "message": "Product XYZ is below reorder level",
      "isRead": false,
      "createdAt": "2025-01-19T10:00:00"
    }
  ],
  "totalElements": 10,
  "unreadCount": 5
}
```

### Mark Notification as Read

**Endpoint:** `PATCH /notifications/{id}/read`  
**Auth Required:** Yes

### Mark All Notifications as Read

**Endpoint:** `POST /notifications/mark-all-read`  
**Auth Required:** Yes

---

## Global Search

### Search All Entities

**Endpoint:** `GET /search`  
**Auth Required:** Yes

**Query Parameters:**
- `q` (required): Search query

**Response:**
```json
{
  "products": [...],
  "customers": [...],
  "suppliers": [...],
  "salesOrders": [...]
}
```

---

## Health & Monitoring

### Health Check

**Endpoint:** `GET /health`  
**Auth Required:** No

**Response:**
```json
{
  "status": "UP",
  "timestamp": "2025-01-19T10:00:00",
  "service": "Mula ERP Backend"
}
```

### Actuator Health

**Endpoint:** `GET /actuator/health`  
**Auth Required:** No

### Actuator Metrics

**Endpoint:** `GET /actuator/metrics`  
**Auth Required:** No

---

## Error Responses

### 400 Bad Request
```json
{
  "timestamp": "2025-01-19T10:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "path": "/api/v1/products"
}
```

### 401 Unauthorized
```json
{
  "timestamp": "2025-01-19T10:00:00",
  "status": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "path": "/api/v1/products"
}
```

### 404 Not Found
```json
{
  "timestamp": "2025-01-19T10:00:00",
  "status": 404,
  "error": "Not Found",
  "message": "Product not found",
  "path": "/api/v1/products/uuid"
}
```

### 429 Too Many Requests
```json
{
  "timestamp": "2025-01-19T10:00:00",
  "status": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "timestamp": "2025-01-19T10:00:00",
  "status": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "path": "/api/v1/products"
}
```

---

## Rate Limiting

All API endpoints are rate-limited to **100 requests per minute per IP address**.

**Headers:**
- `X-Rate-Limit-Remaining`: Number of requests remaining
- `X-Rate-Limit-Retry-After-Seconds`: Seconds until rate limit resets (when exceeded)

---

## Authentication

All endpoints (except `/auth/login` and `/health`) require authentication.

**Header:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Token Expiration:** 24 hours

---

## Pagination

List endpoints support pagination with the following parameters:

- `page`: Page number (0-indexed, default: 0)
- `size`: Page size (default: 20, max: 100)
- `sort`: Sort field and direction (e.g., `name,asc` or `createdAt,desc`)

**Response includes:**
- `content`: Array of items
- `totalElements`: Total number of items
- `totalPages`: Total number of pages
- `size`: Page size
- `number`: Current page number

---

## Interactive Documentation

For interactive API documentation with the ability to test endpoints:

**Swagger UI:** http://localhost:8080/swagger-ui.html

---

*Last Updated: Phase 5 - Production Ready*
*Version: 1.0.0*
