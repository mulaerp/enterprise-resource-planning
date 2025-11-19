# Mula ERP User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Product Management](#product-management)
4. [Customer Management](#customer-management)
5. [Supplier Management](#supplier-management)
6. [Sales Orders](#sales-orders)
7. [Reports](#reports)
8. [Search & Notifications](#search--notifications)

---

## Getting Started

### Logging In

1. Navigate to the Mula ERP login page
2. Enter your email address and password
3. Click "Sign In"

**Default Admin Credentials:**
- Email: `admin@mulaerp.com`
- Password: `admin123`

⚠️ **Important:** Change the default password after first login in production environments.

### Navigation

The main navigation menu is located on the left side of the screen:
- **Dashboard** - Overview of key metrics and recent activity
- **Products** - Manage product catalog and inventory
- **Customers** - Manage customer information
- **Suppliers** - Manage supplier information
- **Sales Orders** - Create and manage sales orders
- **Reports** - View sales and inventory reports

---

## Dashboard

The dashboard provides an at-a-glance view of your business:

### Key Metrics
- **Total Revenue** - Total sales revenue for the current period
- **Total Orders** - Number of sales orders
- **Total Customers** - Number of active customers
- **Low Stock Items** - Products below reorder level

### Charts
- **Sales Trend** - Line chart showing sales over time
- **Top Products** - Bar chart of best-selling products
- **Order Status** - Pie chart of order statuses

### Recent Activity
- Recent sales orders
- Low stock alerts
- Recent customer activity

---

## Product Management

### Viewing Products

1. Click **Products** in the navigation menu
2. View the list of all products with:
   - SKU
   - Name
   - Category
   - Price
   - Stock quantity
   - Status

### Searching Products

Use the search bar at the top of the product list to search by:
- Product name
- SKU
- Description

### Creating a New Product

1. Click **Add Product** button
2. Fill in the required fields:
   - **SKU** (required) - Unique product identifier
   - **Name** (required) - Product name
   - **Description** - Detailed product description
   - **Category** - Select from dropdown
   - **Unit Price** (required) - Selling price
   - **Cost Price** (required) - Purchase/manufacturing cost
   - **Stock Quantity** (required) - Current inventory level
   - **Reorder Level** (required) - Minimum stock before reorder alert
   - **Status** - ACTIVE or INACTIVE
3. Click **Save**

### Editing a Product

1. Click the **Edit** button next to the product
2. Modify the fields as needed
3. Click **Save**

### Deleting a Product

1. Click the **Delete** button next to the product
2. Confirm the deletion in the dialog
3. Product will be soft-deleted (not permanently removed)

### Low Stock Alerts

Products with stock quantity below the reorder level will:
- Appear in the "Low Stock Items" dashboard widget
- Be highlighted in the product list
- Generate notifications

---

## Customer Management

### Viewing Customers

1. Click **Customers** in the navigation menu
2. View the list of all customers with:
   - Name
   - Email
   - Phone
   - Status
   - Credit limit

### Creating a New Customer

1. Click **Add Customer** button
2. Fill in the required fields:
   - **Name** (required) - Customer name
   - **Email** (required) - Email address
   - **Phone** - Contact phone number
   - **Address** - Physical address
   - **Tax ID** - Tax identification number
   - **Credit Limit** - Maximum credit allowed
   - **Status** - ACTIVE or INACTIVE
3. Click **Save**

### Editing a Customer

1. Click the **Edit** button next to the customer
2. Modify the fields as needed
3. Click **Save**

### Deleting a Customer

1. Click the **Delete** button next to the customer
2. Confirm the deletion
3. Customer will be soft-deleted

---

## Supplier Management

### Viewing Suppliers

1. Click **Suppliers** in the navigation menu
2. View the list of all suppliers

### Creating a New Supplier

1. Click **Add Supplier** button
2. Fill in the required fields:
   - **Name** (required)
   - **Email** (required)
   - **Phone**
   - **Address**
   - **Tax ID**
   - **Payment Terms** - e.g., "Net 30"
   - **Status** - ACTIVE or INACTIVE
3. Click **Save**

### Managing Suppliers

Similar to customer management:
- Edit supplier information
- Delete suppliers (soft delete)
- Search and filter suppliers

---

## Sales Orders

### Viewing Sales Orders

1. Click **Sales Orders** in the navigation menu
2. View all orders with:
   - Order number
   - Customer
   - Order date
   - Status
   - Total amount

### Creating a Sales Order

1. Click **Create Order** button
2. Select a **Customer** from the dropdown
3. Set **Order Date** and **Delivery Date**
4. Add line items:
   - Click **Add Item**
   - Select **Product**
   - Enter **Quantity**
   - Unit price and total are calculated automatically
   - Optionally add **Discount** and **Tax Rate**
5. Review the order summary:
   - Subtotal
   - Total discount
   - Total tax
   - Grand total
6. Add **Notes** if needed
7. Click **Save**

### Order Statuses

- **DRAFT** - Order is being created
- **CONFIRMED** - Order is confirmed
- **PROCESSING** - Order is being processed
- **SHIPPED** - Order has been shipped
- **DELIVERED** - Order has been delivered
- **CANCELLED** - Order has been cancelled

### Updating Order Status

1. Open the sales order detail page
2. Click **Update Status** button
3. Select the new status
4. Confirm the change

### Editing a Sales Order

1. Click the **Edit** button on the order
2. Modify order details or line items
3. Click **Save**

⚠️ **Note:** Only DRAFT orders can be fully edited. Confirmed orders have restrictions.

---

## Reports

### Sales Report

1. Click **Reports** → **Sales Report**
2. Select date range:
   - Start date
   - End date
3. Click **Generate Report**
4. View:
   - Total sales
   - Number of orders
   - Average order value
   - Sales by product
   - Sales by customer
5. Click **Export** to download as Excel/PDF

### Inventory Report

1. Click **Reports** → **Inventory Report**
2. View:
   - Current stock levels
   - Stock value
   - Low stock items
   - Out of stock items
   - Stock movement history
3. Click **Export** to download

### Report Filters

Most reports support filtering by:
- Date range
- Customer
- Product
- Category
- Status

---

## Search & Notifications

### Global Search

1. Click the search icon in the top navigation
2. Enter search term
3. View results from:
   - Products
   - Customers
   - Suppliers
   - Sales orders
4. Click a result to navigate to the detail page

### Notifications

1. Click the bell icon in the top navigation
2. View notifications:
   - Low stock alerts
   - Order status changes
   - System notifications
3. Click a notification to view details
4. Click **Mark as Read** to dismiss
5. Click **Mark All as Read** to clear all notifications

### Notification Types

- **Low Stock** - Product below reorder level
- **Order Created** - New sales order created
- **Order Updated** - Order status changed
- **System** - System messages and alerts

---

## Tips & Best Practices

### Product Management
- Use consistent SKU naming conventions
- Set realistic reorder levels to avoid stockouts
- Keep product descriptions detailed and accurate
- Regularly review and update pricing

### Customer Management
- Keep customer information up to date
- Set appropriate credit limits
- Monitor customer payment history
- Maintain good communication

### Sales Orders
- Always verify customer information before creating orders
- Double-check quantities and pricing
- Add notes for special instructions
- Update order status promptly

### Inventory Management
- Conduct regular stock counts
- Investigate discrepancies immediately
- Monitor low stock alerts daily
- Plan reorders in advance

### Reporting
- Generate reports regularly
- Compare period-over-period performance
- Use reports to identify trends
- Export reports for record-keeping

---

## Troubleshooting

### Cannot Login
- Verify email and password are correct
- Check if account is active
- Contact system administrator

### Product Not Saving
- Ensure all required fields are filled
- Check that SKU is unique
- Verify numeric fields have valid values

### Order Total Incorrect
- Verify product prices are correct
- Check discount and tax calculations
- Ensure quantities are accurate

### Report Not Loading
- Check date range is valid
- Ensure you have data for the selected period
- Try refreshing the page

### Notifications Not Appearing
- Check notification settings
- Verify browser allows notifications
- Refresh the page

---

## Keyboard Shortcuts

- **Ctrl/Cmd + K** - Open global search
- **Ctrl/Cmd + S** - Save current form
- **Esc** - Close modal/dialog
- **Tab** - Navigate between form fields

---

## Support

For technical support or questions:
- Email: support@mulaerp.com
- Documentation: https://docs.mulaerp.com
- System Administrator: Contact your IT department

---

## Glossary

- **SKU** - Stock Keeping Unit, unique product identifier
- **Reorder Level** - Minimum stock quantity before reorder alert
- **Credit Limit** - Maximum amount a customer can owe
- **Soft Delete** - Record is marked as deleted but not removed from database
- **Tax ID** - Tax identification number for business entities
- **Net 30** - Payment due within 30 days

---

*Last Updated: Phase 5 - Production Ready*
*Version: 1.0.0*
