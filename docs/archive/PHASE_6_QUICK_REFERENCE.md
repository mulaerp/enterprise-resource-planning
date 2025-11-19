# Phase 6 Quick Reference

Quick reference for Phase 6.5, 6.7, and 6.8 features.

---

## 🧮 Accounting (6.5)

### URLs
- Dashboard: `http://localhost:5173/accounting`
- Accounts: `http://localhost:5173/accounting/accounts`
- Journal Entries: `http://localhost:5173/accounting/journal-entries`
- Trial Balance: `http://localhost:5173/accounting/trial-balance`

### API Endpoints
```bash
# Chart of Accounts
GET    /api/v1/accounting/accounts
POST   /api/v1/accounting/accounts
PUT    /api/v1/accounting/accounts/{id}
DELETE /api/v1/accounting/accounts/{id}

# Journal Entries
GET    /api/v1/accounting/journal-entries
POST   /api/v1/accounting/journal-entries
POST   /api/v1/accounting/journal-entries/{id}/post

# Reports
GET    /api/v1/accounting/reports/trial-balance
GET    /api/v1/accounting/reports/account-ledger/{accountId}
```

### Account Types
- `ASSET` - Assets (1000-1999)
- `LIABILITY` - Liabilities (2000-2999)
- `EQUITY` - Equity (3000-3999)
- `REVENUE` - Revenue (4000-4999)
- `EXPENSE` - Expenses (5000-5999)

### Default Accounts
```
1110 - Cash and Cash Equivalents
1120 - Accounts Receivable
1130 - Inventory
2110 - Accounts Payable
3100 - Capital
4100 - Sales Revenue
5100 - Cost of Goods Sold
5210 - Salaries and Wages
```

### Journal Entry Example
```json
{
  "entryDate": "2025-01-19",
  "description": "Record sales revenue",
  "lines": [
    {
      "accountId": "1110-uuid",
      "debit": 1000.00,
      "credit": 0,
      "description": "Cash received"
    },
    {
      "accountId": "4100-uuid",
      "debit": 0,
      "credit": 1000.00,
      "description": "Sales revenue"
    }
  ]
}
```

### Key Features
- ✅ Double-entry bookkeeping
- ✅ Balanced entry validation
- ✅ Draft/Posted workflow
- ✅ Automatic balance updates
- ✅ Trial balance report
- ✅ Account hierarchy

---

## 🔔 WebSocket Real-time Updates (6.7)

### Connection
- **Endpoint:** `ws://localhost:8080/ws`
- **Protocol:** STOMP over SockJS
- **Topic:** `/topic/updates`

### Connection Indicator
- **Location:** Sidebar (top right)
- **Green WiFi icon:** Connected
- **Red WiFi icon:** Disconnected

### Message Types
```typescript
{
  type: "NOTIFICATION" | "UPDATE" | "ALERT",
  message: string,
  data: any,
  timestamp: string
}
```

### Notification Events
- **New Order:** When sales order created
- **Order Status:** When order status changes
- **Low Stock:** When stock falls below reorder level
- **New Invoice:** When invoice created
- **Payment Received:** When payment recorded

### Frontend Usage
```typescript
import { useWebSocket } from '../contexts/WebSocketContext';

function MyComponent() {
  const { connected, lastMessage } = useWebSocket();
  
  return (
    <div>
      Status: {connected ? 'Connected' : 'Disconnected'}
      Last: {lastMessage?.message}
    </div>
  );
}
```

### Backend Usage
```java
@Autowired
private WebSocketService webSocketService;

// Send notification
webSocketService.broadcastNotification("New order created", orderData);

// Send update
webSocketService.broadcastUpdate("Order status changed", orderData);

// Send alert
webSocketService.broadcastAlert("Low stock alert", productData);
```

---

## 📦 Advanced Inventory (6.8)

### URLs
- Stock Adjustments: `http://localhost:5173/inventory/adjustments`

### API Endpoints
```bash
# Stock Adjustments
GET    /api/v1/inventory/adjustments
POST   /api/v1/inventory/adjustments
GET    /api/v1/inventory/adjustments/{id}
DELETE /api/v1/inventory/adjustments/{id}
GET    /api/v1/inventory/adjustments/product/{productId}
```

### Adjustment Types
- `INCREASE` - Add stock
- `DECREASE` - Remove stock
- `RECOUNT` - Set exact quantity

### Stock Adjustment Example
```json
{
  "productId": "product-uuid",
  "warehouseId": "warehouse-uuid",
  "adjustmentType": "INCREASE",
  "quantityAdjusted": 100,
  "reason": "Stock received from supplier",
  "notes": "Batch #12345",
  "adjustmentDate": "2025-01-19"
}
```

### Database Tables
- `product_batches` - Batch/lot tracking
- `product_serials` - Serial number tracking
- `stock_adjustments` - Stock adjustments
- `stock_transfers` - Inter-warehouse transfers
- `stock_transfer_items` - Transfer line items
- `warehouse_stock` - Multi-warehouse stock levels

### Product Fields Added
- `track_batches` - Enable batch tracking
- `track_serials` - Enable serial tracking
- `barcode` - Product barcode

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Services
```bash
docker-compose up --build
```

### 3. Access Features
```
Accounting:  http://localhost:5173/accounting
Inventory:   http://localhost:5173/inventory/adjustments
WebSocket:   Check sidebar indicator
```

### 4. Test WebSocket
```javascript
// Browser console
const socket = new SockJS('http://localhost:8080/ws');
const client = Stomp.over(socket);
client.connect({}, () => {
  client.subscribe('/topic/updates', (msg) => {
    console.log(JSON.parse(msg.body));
  });
});
```

---

## 📊 Common Tasks

### Create Journal Entry
1. Navigate to `/accounting/journal-entries`
2. Click "New Entry"
3. Enter date and description
4. Add lines (must balance)
5. Save
6. Post entry

### View Trial Balance
1. Navigate to `/accounting/trial-balance`
2. View all account balances
3. Verify totals balance

### Create Stock Adjustment
1. Navigate to `/inventory/adjustments`
2. Click "New Adjustment"
3. Select product and warehouse
4. Choose adjustment type
5. Enter quantity and reason
6. Save

### Monitor Real-time Updates
1. Check WebSocket indicator (green = connected)
2. Create a sales order
3. Watch for toast notification
4. Update product stock below reorder level
5. Watch for low stock alert

---

## 🔧 Configuration

### WebSocket (Production)
Update `frontend/src/contexts/WebSocketContext.tsx`:
```typescript
const socket = new SockJS('https://your-domain.com/ws');
```

### Email (Optional)
Add to `backend/src/main/resources/application.yml`:
```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: your-email@gmail.com
    password: your-app-password
```

---

## 🐛 Troubleshooting

### WebSocket Not Connecting
```bash
# Check backend
curl http://localhost:8080/actuator/health

# Check browser console
# Should see: "WebSocket connected"
```

### Accounting Pages Not Loading
```bash
# Check database
docker-compose exec postgres psql -U mulaerp -d mulaerp
SELECT COUNT(*) FROM accounts;
# Should return 30+
```

### Stock Adjustments Not Working
```bash
# Check API
curl http://localhost:8080/api/v1/inventory/adjustments

# Check database
SELECT COUNT(*) FROM stock_adjustments;
```

---

## 📚 Documentation

- **Complete Guide:** `docs/phases/PHASE_6_COMPLETE.md`
- **Installation:** `PHASE_6_INSTALLATION.md`
- **Summary:** `PHASE_6_SUMMARY.md`
- **Commit Info:** `COMMIT_SUMMARY.md`

---

## 🎯 Key Shortcuts

### Navigation
- `/accounting` - Accounting dashboard
- `/accounting/accounts` - Chart of accounts
- `/accounting/journal-entries` - Journal entries
- `/accounting/trial-balance` - Trial balance
- `/inventory/adjustments` - Stock adjustments

### API Testing
```bash
# Accounting
curl http://localhost:8080/api/v1/accounting/accounts
curl http://localhost:8080/api/v1/accounting/reports/trial-balance

# Inventory
curl http://localhost:8080/api/v1/inventory/adjustments
```

---

## ✅ Verification

Quick checks after installation:

```bash
# 1. Frontend dependencies
cd frontend && npm list sockjs-client stompjs

# 2. Database tables
docker-compose exec postgres psql -U mulaerp -d mulaerp -c "SELECT COUNT(*) FROM accounts;"

# 3. Backend endpoints
curl http://localhost:8080/api/v1/accounting/accounts
curl http://localhost:8080/api/v1/inventory/adjustments

# 4. WebSocket
# Open browser console, should see "WebSocket connected"
```

---

*Quick reference for Phase 6.5, 6.7, 6.8*  
*Last updated: January 19, 2025*
