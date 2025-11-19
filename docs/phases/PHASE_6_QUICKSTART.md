# Phase 6 Quick Start Guide

Get started with the new Phase 6 features in minutes!

---

## Prerequisites

- Backend running on `http://localhost:8080`
- Frontend running on `http://localhost:5173`
- Database seeded with admin user

---

## Quick Start

### 1. Start Services

```bash
# Terminal 1 - Backend
cd backend
mvn spring-boot:run

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Login

Navigate to `http://localhost:5173` and login:
- Email: `admin@mulaerp.com`
- Password: `admin123`

---

## Feature Walkthroughs

### Purchase Orders

1. Click **Purchase Orders** in the sidebar
2. Click **New Purchase Order**
3. Select a supplier
4. Add products and quantities
5. Click **Create Purchase Order**
6. View the order and click **Mark as Sent**
7. Click **Mark as Received** to update stock

**Result:** Stock quantities automatically updated!

---

### Invoices

1. Click **Invoices** in the sidebar
2. Click **New Invoice**
3. Select a customer
4. Add line items (products or custom descriptions)
5. Set due date
6. Click **Create Invoice**
7. View the invoice and click **Mark as Sent**

**Result:** Invoice ready for payment!

---

### Payments

1. Click **Payments** in the sidebar
2. Click **Record Payment**
3. Select an invoice (only unpaid invoices shown)
4. Enter payment amount (defaults to balance due)
5. Select payment method
6. Click **Record Payment**

**Result:** Invoice automatically marked as PAID when fully paid!

---

### User Management

1. Click **Users** in the sidebar
2. Click **New User**
3. Enter email, password, and full name
4. Select role (USER, MANAGER, or ADMIN)
5. Click **Create User**

**Result:** New user can now login!

---

### Company Settings

1. Click **Settings** in the sidebar
2. Update company information
3. Set currency (default: USD)
4. Add contact details
5. Click **Save Settings**

**Result:** Company settings saved!

---

## API Testing

### Using Swagger UI

1. Navigate to `http://localhost:8080/swagger-ui.html`
2. Expand any endpoint group:
   - Purchase Orders
   - Invoices
   - Payments
   - Users
   - Companies
3. Click **Try it out**
4. Fill in parameters
5. Click **Execute**

### Using cURL

**Create Purchase Order:**
```bash
curl -X POST http://localhost:8080/api/v1/purchase-orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "SUPPLIER_UUID",
    "orderDate": "2025-01-19",
    "expectedDate": "2025-02-19",
    "tax": 0,
    "items": [{
      "productId": "PRODUCT_UUID",
      "quantity": 10,
      "unitPrice": 50.00,
      "taxRate": 0
    }]
  }'
```

**Create Invoice:**
```bash
curl -X POST http://localhost:8080/api/v1/invoices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUSTOMER_UUID",
    "invoiceDate": "2025-01-19",
    "dueDate": "2025-02-19",
    "tax": 0,
    "items": [{
      "description": "Product or Service",
      "quantity": 1,
      "unitPrice": 100.00,
      "taxRate": 0
    }]
  }'
```

**Record Payment:**
```bash
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "INVOICE_UUID",
    "paymentDate": "2025-01-19",
    "amount": 100.00,
    "method": "CASH"
  }'
```

---

## Email Configuration (Optional)

### For Gmail:

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Add to `.env`:
```bash
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-16-char-app-password
MAIL_FROM=noreply@mulaerp.com
```
4. Restart backend

### Test Email:

The system will automatically send emails for:
- Low stock alerts (when product stock < reorder level)
- Invoice notifications (when invoice is marked as SENT)
- Payment confirmations (when payment is recorded)
- Order confirmations (when sales order is confirmed)

---

## Common Workflows

### Complete Purchase-to-Stock Workflow

1. **Create Purchase Order**
   - Navigate to Purchase Orders
   - Create new PO with items
   - Mark as SENT

2. **Receive Stock**
   - Open the PO
   - Click "Mark as Received"
   - Stock automatically updated

3. **Verify Stock**
   - Navigate to Products
   - Check stock quantities increased

---

### Complete Invoice-to-Payment Workflow

1. **Create Invoice**
   - Navigate to Invoices
   - Create new invoice
   - Mark as SENT

2. **Record Payment**
   - Navigate to Payments
   - Record payment for the invoice
   - Invoice automatically marked as PAID

3. **Verify Payment**
   - Open the invoice
   - Check balance due is $0.00
   - Status is PAID

---

### Partial Payment Workflow

1. **Create Invoice** for $1000
2. **Record Payment** for $400
   - Balance due: $600
   - Status: SENT
3. **Record Payment** for $600
   - Balance due: $0
   - Status: PAID

---

## Troubleshooting

### Backend Issues

**Problem:** API returns 401 Unauthorized
**Solution:** Login again to get a fresh JWT token

**Problem:** Email not sending
**Solution:** Check SMTP credentials in `.env` and restart backend

**Problem:** Stock not updating
**Solution:** Ensure PO status is changed to RECEIVED

### Frontend Issues

**Problem:** Page not loading
**Solution:** Check browser console for errors, ensure backend is running

**Problem:** Form validation errors
**Solution:** Check all required fields are filled

**Problem:** Search not working
**Solution:** Ensure search query is not empty

---

## Next Steps

1. **Explore the UI** - Try all the new features
2. **Test Workflows** - Complete end-to-end business processes
3. **Configure Email** - Set up SMTP for notifications
4. **Add Test Data** - Create sample orders, invoices, payments
5. **Review API Docs** - Check Swagger UI for all endpoints

---

## Support

- **Documentation:** See `PHASE_6_IMPLEMENTATION.md` for details
- **API Reference:** http://localhost:8080/swagger-ui.html
- **Architecture:** See `docs/ARCHITECTURE.md`
- **User Manual:** See `docs/USER_MANUAL.md`

---

## What's Working

✅ Purchase order creation and management  
✅ Stock receiving from purchase orders  
✅ Invoice creation with line items  
✅ Payment recording with invoice allocation  
✅ Automatic invoice status updates  
✅ User management with roles  
✅ Company settings  
✅ Email notifications (with SMTP configured)  
✅ Search and filtering  
✅ Caching for performance  

---

## What's Next

⏳ Basic Accounting module (optional)  
⏳ PDF generation for invoices  
⏳ Advanced reporting  
⏳ Recurring invoices  
⏳ Payment plans  

---

*Happy testing! 🚀*
