# Phase 6 Installation Guide

Quick guide to install and test Phase 6 features (6.5, 6.7, 6.8).

---

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed
- Java 21+ installed (for local development)
- Maven 3.9+ installed (for local development)

---

## Installation Steps

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

This will install:
- `sockjs-client` - WebSocket client
- `stompjs` - STOMP protocol
- Type definitions for both

### 2. Build and Start Services

```bash
# From project root
docker-compose down
docker-compose up --build
```

Or for local development:

```bash
# Terminal 1: Start backend
cd backend
mvn spring-boot:run

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 3. Verify Database Migrations

The following migrations should run automatically:
- `V12__create_accounting_tables.sql` - Accounting tables
- `V13__create_advanced_inventory_tables.sql` - Advanced inventory tables

Check logs for:
```
Flyway: Migrating schema to version 12 - create accounting tables
Flyway: Migrating schema to version 13 - create advanced inventory tables
```

---

## Testing Phase 6 Features

### 6.5 Basic Accounting

1. **Navigate to Accounting:**
   ```
   http://localhost:5173/accounting
   ```

2. **Test Chart of Accounts:**
   - Click "Chart of Accounts"
   - Should see 30+ default accounts
   - Try creating a new account

3. **Test Journal Entries:**
   - Click "Journal Entries"
   - Click "New Entry"
   - Add at least 2 lines (debit and credit must balance)
   - Save and post the entry

4. **Test Trial Balance:**
   - Click "Trial Balance"
   - Should see all accounts with balances
   - Verify totals are balanced

### 6.7 WebSocket Real-time Updates

1. **Check Connection:**
   - Look at sidebar (top right area)
   - Should see green WiFi icon (connected)
   - Hover over it to see "Real-time updates active"

2. **Test Order Notification:**
   - Navigate to Sales Orders
   - Create a new sales order
   - Should see toast notification: "New order created"

3. **Test Status Change:**
   - Open an existing order
   - Change status
   - Should see toast notification: "Order status updated"

4. **Test Low Stock Alert:**
   - Navigate to Products
   - Edit a product
   - Set stock quantity below reorder level
   - Should see toast notification: "Low stock alert"

### 6.8 Advanced Inventory

1. **Navigate to Stock Adjustments:**
   ```
   http://localhost:5173/inventory/adjustments
   ```

2. **Create Stock Adjustment:**
   - Click "New Adjustment"
   - Select a product
   - Choose adjustment type (INCREASE/DECREASE/RECOUNT)
   - Enter quantity and reason
   - Save

3. **Verify Stock Updated:**
   - Navigate to Products
   - Find the product you adjusted
   - Verify stock quantity changed

---

## API Testing

### Test Accounting Endpoints

```bash
# Get chart of accounts
curl http://localhost:8080/api/v1/accounting/accounts

# Get trial balance
curl http://localhost:8080/api/v1/accounting/reports/trial-balance

# Get journal entries
curl http://localhost:8080/api/v1/accounting/journal-entries
```

### Test Inventory Endpoints

```bash
# Get stock adjustments
curl http://localhost:8080/api/v1/inventory/adjustments

# Create adjustment (requires auth token)
curl -X POST http://localhost:8080/api/v1/inventory/adjustments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": "PRODUCT_UUID",
    "warehouseId": "WAREHOUSE_UUID",
    "adjustmentType": "INCREASE",
    "quantityAdjusted": 10,
    "reason": "Stock received",
    "adjustmentDate": "2025-01-19"
  }'
```

### Test WebSocket Connection

Open browser console and run:

```javascript
// Connect to WebSocket
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, function(frame) {
  console.log('Connected: ' + frame);
  
  // Subscribe to updates
  stompClient.subscribe('/topic/updates', function(message) {
    console.log('Received:', JSON.parse(message.body));
  });
});
```

---

## Troubleshooting

### Frontend Dependencies Not Installing

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### WebSocket Not Connecting

1. Check backend is running: `curl http://localhost:8080/actuator/health`
2. Check WebSocket endpoint: Browser console should show connection attempt
3. Check CORS settings in `SecurityConfig.java`
4. Try clearing browser cache

### Database Migrations Not Running

```bash
# Check Flyway status
docker-compose exec backend mvn flyway:info

# Force migration
docker-compose down -v
docker-compose up --build
```

### Accounting Pages Not Loading

1. Check browser console for errors
2. Verify routes in `App.tsx`
3. Check API endpoints are accessible
4. Verify database tables exist:
   ```sql
   SELECT * FROM accounts LIMIT 5;
   SELECT * FROM journal_entries LIMIT 5;
   ```

### Stock Adjustments Not Working

1. Verify product exists
2. Check warehouse ID (use default: `00000000-0000-0000-0000-000000000001`)
3. Check API response in browser network tab
4. Verify database table exists:
   ```sql
   SELECT * FROM stock_adjustments LIMIT 5;
   ```

---

## Verification Checklist

After installation, verify:

- [ ] Frontend dependencies installed (check `node_modules`)
- [ ] Backend compiles without errors
- [ ] Database migrations V12 and V13 applied
- [ ] Accounting pages accessible
- [ ] Chart of accounts shows default accounts
- [ ] Journal entries can be created
- [ ] Trial balance displays
- [ ] WebSocket indicator shows green (connected)
- [ ] Real-time notifications work
- [ ] Stock adjustments page accessible
- [ ] Stock adjustments can be created
- [ ] Product stock updates after adjustment

---

## Quick Start Commands

```bash
# Complete installation and startup
cd frontend && npm install && cd ..
docker-compose down -v
docker-compose up --build

# Wait for services to start, then test:
# 1. Open http://localhost:5173
# 2. Login with admin@mulaerp.com / admin123
# 3. Navigate to /accounting
# 4. Navigate to /inventory/adjustments
# 5. Check WebSocket indicator (green WiFi icon)
```

---

## Configuration (Optional)

### Email Configuration (Phase 6.6)

Add to `backend/src/main/resources/application.yml`:

```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: your-email@gmail.com
    password: your-app-password
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
```

### WebSocket Production Configuration

Update frontend WebSocket URL for production in `WebSocketContext.tsx`:

```typescript
// Change from:
const socket = new SockJS('http://localhost:8080/ws');

// To:
const socket = new SockJS('https://your-domain.com/ws');
```

---

## Support

If you encounter issues:

1. Check logs: `docker-compose logs backend`
2. Check browser console for frontend errors
3. Verify all services are running: `docker-compose ps`
4. Review documentation: `docs/phases/PHASE_6_COMPLETE.md`

---

## Next Steps

After successful installation:

1. Explore accounting features
2. Test real-time notifications
3. Create stock adjustments
4. Review API documentation: `http://localhost:8080/swagger-ui.html`
5. Consider implementing remaining inventory UI features

---

*Installation guide for Phase 6 (Modules 6.5, 6.7, 6.8)*  
*Last updated: January 19, 2025*
