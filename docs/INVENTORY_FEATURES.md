# Advanced Inventory Features Guide

This guide covers the advanced inventory management features in Mula ERP.

---

## Table of Contents

1. [Batch/Lot Tracking](#batchlot-tracking)
2. [Serial Number Tracking](#serial-number-tracking)
3. [Stock Transfers](#stock-transfers)
4. [Email Notifications](#email-notifications)

---

## Batch/Lot Tracking

Track products by batch or lot numbers with expiry date management.

### Use Cases

- Food and beverage products with expiry dates
- Pharmaceuticals with batch numbers
- Cosmetics with manufacture dates
- Any product requiring traceability

### Features

- Unique batch number per batch
- Manufacture and expiry date tracking
- Quantity management per batch
- Status tracking (ACTIVE, EXPIRED, RECALLED)
- Automatic expiry alerts (30 days before expiry)
- FIFO (First In, First Out) support

### API Usage

```bash
# Create a batch
POST /api/v1/batches
{
  "productId": "uuid",
  "batchNumber": "BATCH-2025-001",
  "manufactureDate": "2025-01-01",
  "expiryDate": "2025-12-31",
  "quantity": 100,
  "notes": "First batch of 2025"
}

# Get expiring batches (next 30 days)
GET /api/v1/batches/expiring?daysAhead=30

# Get batches by product
GET /api/v1/batches/product/{productId}

# Update batch status
PATCH /api/v1/batches/{id}/status?status=EXPIRED
```

### UI Navigation

```
Inventory → Batches → New Batch
```

### Best Practices

1. **Naming Convention:** Use consistent batch numbering (e.g., BATCH-YYYY-NNN)
2. **Expiry Dates:** Always set expiry dates for perishable items
3. **Regular Audits:** Review expiring batches weekly
4. **FIFO:** Use oldest batches first (sorted by expiry date)
5. **Zero Quantity:** Delete batches only when quantity reaches zero

---

## Serial Number Tracking

Track individual items by unique serial numbers with warranty management.

### Use Cases

- Electronics with serial numbers
- Appliances with warranty
- High-value items requiring individual tracking
- Items with service history

### Features

- Unique serial number per item
- Purchase date tracking
- Warranty expiry date tracking
- Status tracking (IN_STOCK, SOLD, RETURNED, DEFECTIVE, WARRANTY_CLAIM)
- Customer and sales order linking
- Automatic warranty expiry alerts (30 days before expiry)

### API Usage

```bash
# Create a serial number
POST /api/v1/serials
{
  "productId": "uuid",
  "serialNumber": "SN-2025-001",
  "purchaseDate": "2025-01-15",
  "warrantyExpiryDate": "2026-01-15",
  "notes": "Purchased from Supplier A"
}

# Get available serials for a product
GET /api/v1/serials/product/{productId}/available

# Get serials by customer
GET /api/v1/serials/customer/{customerId}

# Get expiring warranties
GET /api/v1/serials/warranty-expiring?daysAhead=30

# Mark as sold
PATCH /api/v1/serials/{id}/status?status=SOLD
```

### UI Navigation

```
Inventory → Serial Numbers → New Serial Number
```

### Workflow

1. **Receiving:** Create serial numbers when products arrive
2. **Sales:** Mark serial as SOLD and link to customer/order
3. **Returns:** Update status to RETURNED
4. **Warranty Claims:** Update status to WARRANTY_CLAIM
5. **Defective:** Update status to DEFECTIVE

### Best Practices

1. **Naming Convention:** Use manufacturer's serial numbers when available
2. **Warranty Tracking:** Always set warranty expiry dates
3. **Customer Service:** Link serials to customers for easy lookup
4. **Proactive Alerts:** Contact customers before warranty expires
5. **Cannot Delete Sold Items:** Sold serials cannot be deleted (data integrity)

---

## Stock Transfers

Transfer inventory between warehouses with full tracking.

### Use Cases

- Moving stock between locations
- Rebalancing inventory across warehouses
- Fulfillment from different locations
- Inter-branch transfers

### Features

- Multi-item transfers
- Batch selection per item
- Status workflow (PENDING → IN_TRANSIT → COMPLETED)
- Transfer validation
- Auto-generated transfer numbers
- Transfer history tracking

### API Usage

```bash
# Create a transfer
POST /api/v1/stock-transfers
{
  "fromWarehouseId": "uuid",
  "toWarehouseId": "uuid",
  "transferDate": "2025-01-19",
  "notes": "Rebalancing stock",
  "items": [
    {
      "productId": "uuid",
      "batchId": "uuid",  // optional
      "quantity": 50
    }
  ]
}

# Update transfer status
PATCH /api/v1/stock-transfers/{id}/status?status=IN_TRANSIT

# Complete transfer
POST /api/v1/stock-transfers/{id}/complete

# Cancel transfer
POST /api/v1/stock-transfers/{id}/cancel

# Get transfers by warehouse
GET /api/v1/stock-transfers/warehouse/{warehouseId}
```

### UI Navigation

```
Inventory → Stock Transfers → New Transfer
```

### Workflow

1. **Create Transfer (PENDING):**
   - Select source and destination warehouses
   - Add items with quantities
   - Optionally select specific batches
   - Save as PENDING

2. **Ship Transfer (IN_TRANSIT):**
   - Review transfer details
   - Update status to IN_TRANSIT
   - Items are reserved at source

3. **Receive Transfer (COMPLETED):**
   - Verify received quantities
   - Complete the transfer
   - Stock is moved from source to destination

4. **Cancel Transfer:**
   - Only PENDING or IN_TRANSIT can be cancelled
   - COMPLETED transfers cannot be cancelled

### Best Practices

1. **Validation:** System prevents transfers between same warehouse
2. **Batch Tracking:** Select specific batches for better traceability
3. **Status Updates:** Update status promptly to reflect actual movement
4. **Cannot Edit Completed:** Completed transfers are locked
5. **Delete Only Pending:** Only PENDING or CANCELLED transfers can be deleted

---

## Email Notifications

Automated email alerts for important inventory events.

### Email Templates

1. **Low Stock Alert**
   - Sent to: Admin
   - Trigger: Product stock ≤ reorder level
   - Frequency: Daily at 9 AM

2. **Order Confirmation**
   - Sent to: Customer
   - Trigger: Sales order created
   - Frequency: Immediate

3. **Invoice Notification**
   - Sent to: Customer
   - Trigger: Invoice generated
   - Frequency: Immediate

4. **Payment Receipt**
   - Sent to: Customer
   - Trigger: Payment received
   - Frequency: Immediate

5. **User Registration**
   - Sent to: New user
   - Trigger: User account created
   - Frequency: Immediate

6. **Batch Expiry Alert**
   - Sent to: Admin
   - Trigger: Batch expires in ≤ 30 days
   - Frequency: Daily at 9 AM

7. **Warranty Expiry Alert**
   - Sent to: Admin
   - Trigger: Warranty expires in ≤ 30 days
   - Frequency: Daily at 9 AM

### Configuration

#### 1. SMTP Setup (Gmail Example)

```yaml
# application.yml or .env
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: your-email@gmail.com
    password: your-app-password  # Generate from Google Account
    from: noreply@mulaerp.com
```

#### 2. Generate Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
2. Enable 2-factor authentication if not already enabled
3. Generate app password for "Mail"
4. Use the 16-character password in configuration

#### 3. Other SMTP Providers

**Outlook/Office 365:**
```yaml
host: smtp.office365.com
port: 587
```

**SendGrid:**
```yaml
host: smtp.sendgrid.net
port: 587
username: apikey
password: your-sendgrid-api-key
```

**AWS SES:**
```yaml
host: email-smtp.us-east-1.amazonaws.com
port: 587
username: your-smtp-username
password: your-smtp-password
```

### Scheduled Jobs

All scheduled jobs run daily at 9 AM by default.

**Customize Schedule:**

Edit `EmailNotificationScheduler.java`:

```java
// Every 6 hours
@Scheduled(cron = "0 0 */6 * * *")

// Twice daily (9 AM and 5 PM)
@Scheduled(cron = "0 0 9,17 * * *")

// Every Monday at 9 AM
@Scheduled(cron = "0 0 9 * * MON")
```

### Testing Email

```bash
# Test SMTP connection
curl -X POST http://localhost:8080/api/v1/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

### Troubleshooting

**Emails not sending:**
1. Check SMTP credentials
2. Verify firewall allows port 587
3. Check application logs for errors
4. Test with telnet: `telnet smtp.gmail.com 587`

**Gmail blocking:**
1. Enable "Less secure app access" (not recommended)
2. Use App Password instead (recommended)
3. Check Gmail security alerts

**Scheduled jobs not running:**
1. Verify `@EnableScheduling` in main application
2. Check server timezone
3. Review cron expression syntax

---

## Integration Examples

### Batch Tracking in Sales Order

```java
// When creating sales order, select batch
SalesOrderItem item = new SalesOrderItem();
item.setProduct(product);
item.setBatch(batch);  // Select specific batch
item.setQuantity(10);

// System automatically reduces batch quantity
batchTrackingService.updateBatchQuantity(batch.getId(), -10);
```

### Serial Number in Sales Order

```java
// When selling serialized product
ProductSerial serial = serialRepository.findBySerialNumber("SN-001");
serialTrackingService.markSerialAsSold(
    serial.getId(),
    customer.getId(),
    salesOrder.getId()
);
```

### Stock Transfer with Batches

```java
// Transfer specific batch between warehouses
CreateStockTransferRequest request = new CreateStockTransferRequest();
request.setFromWarehouseId(warehouse1.getId());
request.setToWarehouseId(warehouse2.getId());

TransferItemRequest item = new TransferItemRequest();
item.setProductId(product.getId());
item.setBatchId(batch.getId());  // Transfer specific batch
item.setQuantity(50);

request.getItems().add(item);
stockTransferService.createTransfer(request);
```

---

## Reporting

### Batch Reports

- Expiring batches (next 30 days)
- Expired batches requiring action
- Batch quantity by product
- Batch movement history

### Serial Number Reports

- Serials by status
- Warranty expiring (next 30 days)
- Serials by customer
- Serial movement history

### Transfer Reports

- Pending transfers
- Transfers by warehouse
- Transfer history by date range
- Transfer volume by product

---

## Security & Permissions

All inventory features require authentication. Recommended role-based access:

- **Admin:** Full access to all features
- **Warehouse Manager:** Create/edit batches, serials, transfers
- **Sales:** View batches/serials, cannot edit
- **Viewer:** Read-only access

---

## Performance Tips

1. **Batch Queries:** Use product-specific queries instead of loading all batches
2. **Serial Lookups:** Index on serial_number for fast lookups
3. **Transfer History:** Archive old completed transfers
4. **Email Queue:** Emails are sent asynchronously (non-blocking)
5. **Scheduled Jobs:** Run during off-peak hours if needed

---

## FAQ

**Q: Can I delete a batch with remaining quantity?**  
A: No, batches can only be deleted when quantity reaches zero.

**Q: Can I change a serial number after it's sold?**  
A: You can update the serial number string, but cannot delete sold serials.

**Q: What happens if I cancel a transfer?**  
A: Status changes to CANCELLED, but no stock movement occurs.

**Q: How do I disable email notifications?**  
A: Comment out `@Scheduled` annotations in `EmailNotificationScheduler.java`.

**Q: Can I have multiple batches with the same number?**  
A: No, batch numbers must be unique across all products.

**Q: Do transfers automatically update stock levels?**  
A: Currently, transfers track movement but don't automatically update stock. This requires multi-warehouse support completion.

---

## Support

For issues or questions:
- Check logs: `logs/application.log`
- API documentation: `http://localhost:8080/swagger-ui.html`
- Feature status: `.kiro/steering/feature-status.md`

---

*Last updated: January 19, 2025*
