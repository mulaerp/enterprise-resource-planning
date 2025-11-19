# Quick Start: Advanced Inventory Features

Get started with batch tracking, serial numbers, and stock transfers in 5 minutes.

---

## Prerequisites

- Mula ERP backend running on `http://localhost:8080`
- Mula ERP frontend running on `http://localhost:5173`
- At least one product created
- Admin user logged in

---

## 1. Batch/Lot Tracking

### Create Your First Batch

1. Navigate to **Inventory → Batches**
2. Click **New Batch**
3. Fill in the form:
   ```
   Product: Select a product
   Batch Number: BATCH-2025-001
   Manufacture Date: 2025-01-01
   Expiry Date: 2025-12-31
   Quantity: 100
   Notes: First batch of 2025
   ```
4. Click **Save**

### View Expiring Batches

- Batches expiring within 30 days show a ⚠️ warning icon
- Yellow alert icon appears next to expiry date
- Hover over icon to see "Expiring soon"

### API Quick Test

```bash
# Create batch
curl -X POST http://localhost:8080/api/v1/batches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": "YOUR_PRODUCT_ID",
    "batchNumber": "BATCH-2025-001",
    "manufactureDate": "2025-01-01",
    "expiryDate": "2025-12-31",
    "quantity": 100
  }'

# Get all batches
curl http://localhost:8080/api/v1/batches \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 2. Serial Number Tracking

### Create Your First Serial Number

1. Navigate to **Inventory → Serial Numbers**
2. Click **New Serial Number**
3. Fill in the form:
   ```
   Product: Select a product
   Serial Number: SN-2025-001
   Purchase Date: 2025-01-15
   Warranty Expiry: 2026-01-15
   Notes: Laptop serial number
   ```
4. Click **Save**

### View Warranty Expiring

- Serials with warranty expiring within 30 days show a ⚠️ warning icon
- Yellow alert icon appears next to warranty expiry date
- Status badge shows current status (IN_STOCK, SOLD, etc.)

### API Quick Test

```bash
# Create serial
curl -X POST http://localhost:8080/api/v1/serials \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": "YOUR_PRODUCT_ID",
    "serialNumber": "SN-2025-001",
    "purchaseDate": "2025-01-15",
    "warrantyExpiryDate": "2026-01-15"
  }'

# Get available serials
curl http://localhost:8080/api/v1/serials/product/YOUR_PRODUCT_ID/available \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 3. Stock Transfers

### Create Your First Transfer

1. Navigate to **Inventory → Stock Transfers**
2. Click **New Transfer**
3. Fill in the form:
   ```
   From Warehouse: Main Warehouse
   To Warehouse: Secondary Warehouse
   Transfer Date: 2025-01-19
   
   Items:
   - Product: Select a product
   - Quantity: 50
   
   Notes: Rebalancing inventory
   ```
4. Click **Save**

### Complete Transfer Workflow

1. **Create (PENDING):**
   - Transfer is created with PENDING status
   - Yellow badge shows "PENDING"

2. **Ship (IN_TRANSIT):**
   - Click on transfer to view details
   - Update status to IN_TRANSIT
   - Blue badge shows "IN TRANSIT"

3. **Receive (COMPLETED):**
   - Click "Complete Transfer"
   - Green badge shows "COMPLETED"
   - Transfer is locked (cannot edit)

### API Quick Test

```bash
# Create transfer
curl -X POST http://localhost:8080/api/v1/stock-transfers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fromWarehouseId": "00000000-0000-0000-0000-000000000001",
    "toWarehouseId": "00000000-0000-0000-0000-000000000002",
    "transferDate": "2025-01-19",
    "items": [
      {
        "productId": "YOUR_PRODUCT_ID",
        "quantity": 50
      }
    ]
  }'

# Complete transfer
curl -X POST http://localhost:8080/api/v1/stock-transfers/TRANSFER_ID/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 4. Email Notifications

### Setup Email (Gmail)

1. **Generate App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Enable 2FA if not already enabled
   - Generate password for "Mail"
   - Copy 16-character password

2. **Configure Backend:**
   
   Edit `backend/src/main/resources/application.yml`:
   ```yaml
   spring:
     mail:
       host: smtp.gmail.com
       port: 587
       username: your-email@gmail.com
       password: your-16-char-app-password
       from: noreply@mulaerp.com
   ```

3. **Restart Backend:**
   ```bash
   docker-compose restart backend
   ```

### Test Email Notifications

1. **Low Stock Alert:**
   - Create a product with stock quantity ≤ reorder level
   - Wait for scheduled job (9 AM) or trigger manually
   - Check admin email for alert

2. **Batch Expiry Alert:**
   - Create a batch with expiry date within 30 days
   - Wait for scheduled job (9 AM)
   - Check admin email for alert

3. **Warranty Expiry Alert:**
   - Create a serial with warranty expiring within 30 days
   - Wait for scheduled job (9 AM)
   - Check admin email for alert

### Manual Email Test

```bash
# Trigger low stock check manually
# (Add test endpoint in EmailNotificationScheduler)
curl -X POST http://localhost:8080/api/v1/notifications/check-low-stock \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 5. Common Workflows

### Workflow 1: Receiving Inventory with Batches

```
1. Create Purchase Order
2. Receive goods
3. Create Batch for received items
   - Batch Number: From supplier
   - Manufacture Date: From packaging
   - Expiry Date: From packaging
   - Quantity: Received quantity
4. Update product stock
```

### Workflow 2: Selling Serialized Products

```
1. Create Sales Order
2. Select product with serial tracking
3. Select available serial number
4. Mark serial as SOLD
   - Links to customer
   - Links to sales order
5. Generate invoice
6. Customer receives warranty info
```

### Workflow 3: Inter-warehouse Transfer

```
1. Check stock levels at both warehouses
2. Create Stock Transfer
   - From: Warehouse with excess
   - To: Warehouse with shortage
   - Items: Products to transfer
3. Update status to IN_TRANSIT when shipped
4. Complete transfer when received
5. Verify stock levels updated
```

---

## 6. Navigation Quick Reference

```
Dashboard
├── Inventory
│   ├── Products
│   ├── Stock Adjustments
│   ├── Batches ← NEW
│   ├── Serial Numbers ← NEW
│   └── Stock Transfers ← NEW
├── Sales
├── Purchases
└── Reports
```

---

## 7. Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Batch | Alt + N (on Batches page) |
| New Serial | Alt + N (on Serials page) |
| New Transfer | Alt + N (on Transfers page) |
| Search | Ctrl + K (global search) |
| Save Form | Ctrl + S |
| Cancel Form | Esc |

---

## 8. Troubleshooting

### Batches

**Problem:** Cannot delete batch  
**Solution:** Batch must have zero quantity before deletion

**Problem:** Batch number already exists  
**Solution:** Batch numbers must be unique across all products

### Serial Numbers

**Problem:** Cannot delete serial  
**Solution:** Sold serials cannot be deleted (data integrity)

**Problem:** Serial number already exists  
**Solution:** Serial numbers must be unique across all products

### Stock Transfers

**Problem:** Cannot edit transfer  
**Solution:** Only PENDING transfers can be edited

**Problem:** Cannot delete transfer  
**Solution:** Only PENDING or CANCELLED transfers can be deleted

**Problem:** Same warehouse error  
**Solution:** From and To warehouses must be different

### Email Notifications

**Problem:** Emails not sending  
**Solution:** 
1. Check SMTP credentials in application.yml
2. Verify Gmail App Password (not regular password)
3. Check logs: `logs/application.log`
4. Test SMTP: `telnet smtp.gmail.com 587`

**Problem:** Scheduled jobs not running  
**Solution:**
1. Verify `@EnableScheduling` in MulaErpApplication.java
2. Check server timezone
3. Wait until 9 AM for next run

---

## 9. Next Steps

### Learn More

- **Full Documentation:** `docs/INVENTORY_FEATURES.md`
- **API Reference:** `http://localhost:8080/swagger-ui.html`
- **Feature Status:** `.kiro/steering/feature-status.md`

### Advanced Topics

- Batch selection in sales orders
- Serial number warranty tracking
- Multi-warehouse support (coming soon)
- Custom email templates
- Scheduled job customization

### Testing

- **E2E Tests:** `frontend/tests/e2e/`
- **Testing Guide:** `.kiro/steering/testing.md`
- **Manual Testing:** Follow workflows above

---

## 10. Support

### Getting Help

1. **Check Logs:**
   ```bash
   # Backend logs
   tail -f logs/application.log
   
   # Docker logs
   docker-compose logs -f backend
   ```

2. **API Documentation:**
   - Swagger UI: `http://localhost:8080/swagger-ui.html`
   - OpenAPI JSON: `http://localhost:8080/v3/api-docs`

3. **Database:**
   ```bash
   # Access PostgreSQL
   docker-compose exec postgres psql -U mulaerp -d mulaerp
   
   # Check batches
   SELECT * FROM product_batches;
   
   # Check serials
   SELECT * FROM product_serials;
   
   # Check transfers
   SELECT * FROM stock_transfers;
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| 404 on API | Check backend is running on port 8080 |
| CORS error | Verify frontend URL in SecurityConfig.java |
| Database error | Check PostgreSQL is running |
| Email error | Verify SMTP credentials |
| Scheduled job not running | Check @EnableScheduling annotation |

---

## Quick Command Reference

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Restart backend
docker-compose restart backend

# Access database
docker-compose exec postgres psql -U mulaerp -d mulaerp

# Check API health
curl http://localhost:8080/api/v1/health

# Test authentication
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mulaerp.com","password":"admin123"}'
```

---

**Congratulations!** You're now ready to use advanced inventory features in Mula ERP.

For detailed documentation, see `docs/INVENTORY_FEATURES.md`.

---

*Last updated: January 19, 2025*
