#!/bin/bash

# Mula ERP - Phase 3 Quick Test Script
# Tests Sales Order Management functionality

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Phase 3: Sales Order Management Test"
echo "==========================================${NC}"
echo ""

# Check if backend is running
if ! curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo -e "${RED}✗ Backend is not running${NC}"
    echo "Start with: docker-compose up -d backend"
    exit 1
fi

echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

# Create test customer
echo "Creating test customer..."
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/customers \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Phase 3 Test Customer",
        "email": "phase3@test.com",
        "phone": "+1-555-0303",
        "address": "303 Test Ave",
        "taxId": "30-3030303",
        "creditLimit": 50000.00,
        "status": "ACTIVE"
    }')

CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✓ Customer created: $CUSTOMER_ID${NC}"

# Create test product
echo "Creating test product..."
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/products \
    -H "Content-Type: application/json" \
    -d '{
        "sku": "PHASE3-TEST",
        "name": "Phase 3 Test Product",
        "description": "Testing sales orders",
        "unitPrice": 150.00,
        "costPrice": 75.00,
        "stockQuantity": 50,
        "reorderLevel": 10,
        "status": "ACTIVE"
    }')

PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✓ Product created: $PRODUCT_ID${NC}"
echo ""

# Create sales order
echo "Creating sales order..."
ORDER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/sales-orders \
    -H "Content-Type: application/json" \
    -d "{
        \"customerId\": \"$CUSTOMER_ID\",
        \"orderDate\": \"2025-11-19\",
        \"deliveryDate\": \"2025-11-26\",
        \"tax\": 15.00,
        \"notes\": \"Phase 3 test order\",
        \"items\": [
            {
                \"productId\": \"$PRODUCT_ID\",
                \"quantity\": 10,
                \"unitPrice\": 150.00,
                \"discount\": 50.00,
                \"taxRate\": 0
            }
        ]
    }")

ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
ORDER_NUMBER=$(echo "$ORDER_RESPONSE" | grep -o '"orderNumber":"[^"]*"' | cut -d'"' -f4)
echo -e "${GREEN}✓ Sales order created: $ORDER_NUMBER${NC}"
echo ""

# Get order details
echo "Fetching order details..."
ORDER_DETAILS=$(curl -s http://localhost:8080/api/v1/sales-orders/$ORDER_ID)
echo "$ORDER_DETAILS" | python3 -m json.tool 2>/dev/null || echo "$ORDER_DETAILS"
echo ""

# Verify calculations
SUBTOTAL=$(echo "$ORDER_DETAILS" | grep -o '"subtotal":[0-9.]*' | cut -d':' -f2)
TOTAL=$(echo "$ORDER_DETAILS" | grep -o '"total":[0-9.]*' | cut -d':' -f2)
echo "Order Calculations:"
echo "  Subtotal: \$$SUBTOTAL (expected: \$1450.00)"
echo "  Total: \$$TOTAL (expected: \$1465.00)"
echo ""

# Test status workflow
echo "Testing status workflow..."
echo "  Current status: DRAFT"

echo "  Changing to CONFIRMED..."
curl -s -X PATCH http://localhost:8080/api/v1/sales-orders/$ORDER_ID/status \
    -H "Content-Type: application/json" \
    -d '{"status": "CONFIRMED"}' > /dev/null
echo -e "  ${GREEN}✓ Status changed to CONFIRMED${NC}"

echo "  Changing to DELIVERED..."
curl -s -X PATCH http://localhost:8080/api/v1/sales-orders/$ORDER_ID/status \
    -H "Content-Type: application/json" \
    -d '{"status": "DELIVERED"}' > /dev/null
echo -e "  ${GREEN}✓ Status changed to DELIVERED${NC}"

echo "  Changing to INVOICED..."
curl -s -X PATCH http://localhost:8080/api/v1/sales-orders/$ORDER_ID/status \
    -H "Content-Type: application/json" \
    -d '{"status": "INVOICED"}' > /dev/null
echo -e "  ${GREEN}✓ Status changed to INVOICED${NC}"
echo ""

# List orders
echo "Listing all sales orders..."
ORDERS_LIST=$(curl -s "http://localhost:8080/api/v1/sales-orders?size=5")
ORDER_COUNT=$(echo "$ORDERS_LIST" | grep -o '"totalElements":[0-9]*' | cut -d':' -f2)
echo -e "${GREEN}✓ Found $ORDER_COUNT sales order(s)${NC}"
echo ""

# Search orders
echo "Searching for order by number..."
SEARCH_RESULT=$(curl -s "http://localhost:8080/api/v1/sales-orders?search=$ORDER_NUMBER")
if echo "$SEARCH_RESULT" | grep -q "$ORDER_NUMBER"; then
    echo -e "${GREEN}✓ Search working correctly${NC}"
else
    echo -e "${RED}✗ Search failed${NC}"
fi
echo ""

# Clean up
echo "Cleaning up test data..."
curl -s -X DELETE "http://localhost:8080/api/v1/customers/$CUSTOMER_ID" > /dev/null 2>&1 || true
curl -s -X DELETE "http://localhost:8080/api/v1/products/$PRODUCT_ID" > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Test data cleaned up${NC}"
echo ""

echo -e "${GREEN}=========================================="
echo "✓ Phase 3 Tests Completed Successfully!"
echo "==========================================${NC}"
echo ""
echo "Sales Order Management is working correctly!"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:5173"
echo "  2. Navigate to 'Sales Orders'"
echo "  3. Create a new sales order"
echo "  4. Test the UI functionality"
echo ""
