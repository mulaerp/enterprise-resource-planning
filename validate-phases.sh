#!/bin/bash

# Mula ERP - Phase 0 to Phase 3 Validation Script
# This script validates all implemented features from Phase 0, 1, 2, and 3

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "=========================================="
echo "Mula ERP - Phase Validation"
echo "=========================================="
echo ""

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local expected=$2
    curl -s "http://localhost:8080/api/v1/$endpoint" | grep -q "$expected"
}

# Function to test API with data
test_api_post() {
    local endpoint=$1
    local data=$2
    local expected=$3
    curl -s -X POST "http://localhost:8080/api/v1/$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data" | grep -q "$expected"
}

echo -e "${BLUE}Checking Prerequisites...${NC}"
echo ""

# Check if services are running
if ! docker ps | grep -q "postgres"; then
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    echo "Start with: docker-compose up -d postgres"
    exit 1
fi

if ! docker ps | grep -q "valkey"; then
    echo -e "${RED}✗ Valkey is not running${NC}"
    echo "Start with: docker-compose up -d valkey"
    exit 1
fi

if ! curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo -e "${RED}✗ Backend is not running${NC}"
    echo "Start with: docker-compose up -d backend"
    exit 1
fi

if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Frontend is not running (optional for API tests)${NC}"
fi

echo -e "${GREEN}✓ All required services are running${NC}"
echo ""

# ==========================================
# PHASE 0: Infrastructure Tests
# ==========================================
echo -e "${BLUE}=========================================="
echo "PHASE 0: Infrastructure Validation"
echo "==========================================${NC}"
echo ""

run_test "Database connection" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c 'SELECT 1' | grep -q '1 row'"

run_test "Valkey connection" "docker-compose exec -T valkey valkey-cli -a mulaerp-redis-password PING | grep -q 'PONG'"

run_test "Backend health endpoint" "test_api 'health' 'UP'"

run_test "Users table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt users' | grep -q 'users'"

echo ""

# ==========================================
# PHASE 1: Product Management Tests
# ==========================================
echo -e "${BLUE}=========================================="
echo "PHASE 1: Product Management Validation"
echo "==========================================${NC}"
echo ""

run_test "Products table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt products' | grep -q 'products'"

run_test "Product categories table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt product_categories' | grep -q 'product_categories'"

run_test "Products API endpoint" "test_api 'products' 'content'"

run_test "Product categories API endpoint" "test_api 'products/categories' '\['"

run_test "Product categories seeded" "curl -s http://localhost:8080/api/v1/products/categories | grep -q 'Electronics'"

# Create a test product
echo -n "Testing: Create product via API... "
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/products \
    -H "Content-Type: application/json" \
    -d '{
        "sku": "TEST-001",
        "name": "Test Product",
        "description": "Test Description",
        "unitPrice": 100.00,
        "costPrice": 50.00,
        "stockQuantity": 10,
        "reorderLevel": 5,
        "status": "ACTIVE"
    }')

if echo "$PRODUCT_RESPONSE" | grep -q '"sku":"TEST-001"'; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if [ ! -z "$PRODUCT_ID" ]; then
    run_test "Get product by ID" "curl -s http://localhost:8080/api/v1/products/$PRODUCT_ID | grep -q 'TEST-001'"
    
    run_test "Search products" "curl -s 'http://localhost:8080/api/v1/products?search=Test' | grep -q 'TEST-001'"
    
    # Clean up test product
    curl -s -X DELETE "http://localhost:8080/api/v1/products/$PRODUCT_ID" > /dev/null 2>&1
fi

echo ""

# ==========================================
# PHASE 2: Customer Management Tests
# ==========================================
echo -e "${BLUE}=========================================="
echo "PHASE 2: Customer Management Validation"
echo "==========================================${NC}"
echo ""

run_test "Customers table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt customers' | grep -q 'customers'"

run_test "Customer contacts table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt customer_contacts' | grep -q 'customer_contacts'"

run_test "Customers API endpoint" "test_api 'customers' 'content'"

# Create a test customer
echo -n "Testing: Create customer via API... "
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/customers \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Customer Inc",
        "email": "test@customer.com",
        "phone": "+1-555-0100",
        "address": "123 Test St",
        "taxId": "12-3456789",
        "creditLimit": 50000.00,
        "status": "ACTIVE"
    }')

if echo "$CUSTOMER_RESPONSE" | grep -q '"name":"Test Customer Inc"'; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if [ ! -z "$CUSTOMER_ID" ]; then
    run_test "Get customer by ID" "curl -s http://localhost:8080/api/v1/customers/$CUSTOMER_ID | grep -q 'Test Customer Inc'"
    
    run_test "Search customers" "curl -s 'http://localhost:8080/api/v1/customers?search=Test' | grep -q 'Test Customer Inc'"
    
    # Clean up test customer
    curl -s -X DELETE "http://localhost:8080/api/v1/customers/$CUSTOMER_ID" > /dev/null 2>&1
fi

echo ""

# ==========================================
# PHASE 2: Supplier Management Tests
# ==========================================
echo -e "${BLUE}=========================================="
echo "PHASE 2: Supplier Management Validation"
echo "==========================================${NC}"
echo ""

run_test "Suppliers table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt suppliers' | grep -q 'suppliers'"

run_test "Supplier contacts table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt supplier_contacts' | grep -q 'supplier_contacts'"

run_test "Suppliers API endpoint" "test_api 'suppliers' 'content'"

# Create a test supplier
echo -n "Testing: Create supplier via API... "
SUPPLIER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/suppliers \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Supplier Ltd",
        "email": "test@supplier.com",
        "phone": "+1-555-0200",
        "address": "456 Supplier Ave",
        "taxId": "98-7654321",
        "paymentTerms": "Net 30",
        "status": "ACTIVE"
    }')

if echo "$SUPPLIER_RESPONSE" | grep -q '"name":"Test Supplier Ltd"'; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    SUPPLIER_ID=$(echo "$SUPPLIER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if [ ! -z "$SUPPLIER_ID" ]; then
    run_test "Get supplier by ID" "curl -s http://localhost:8080/api/v1/suppliers/$SUPPLIER_ID | grep -q 'Test Supplier Ltd'"
    
    run_test "Search suppliers" "curl -s 'http://localhost:8080/api/v1/suppliers?search=Test' | grep -q 'Test Supplier Ltd'"
    
    # Clean up test supplier
    curl -s -X DELETE "http://localhost:8080/api/v1/suppliers/$SUPPLIER_ID" > /dev/null 2>&1
fi

echo ""

# ==========================================
# PHASE 3: Sales Management Tests
# ==========================================
echo -e "${BLUE}=========================================="
echo "PHASE 3: Sales Management Validation"
echo "==========================================${NC}"
echo ""

run_test "Sales orders table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt sales_orders' | grep -q 'sales_orders'"

run_test "Sales order items table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt sales_order_items' | grep -q 'sales_order_items'"

run_test "Sales orders API endpoint" "test_api 'sales-orders' 'content'"

# Create test data first (customer and product)
echo -n "Setting up test data... "
TEST_CUSTOMER=$(curl -s -X POST http://localhost:8080/api/v1/customers \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Sales Customer",
        "email": "sales@test.com",
        "phone": "+1-555-9999",
        "address": "123 Sales St",
        "taxId": "99-9999999",
        "creditLimit": 100000.00,
        "status": "ACTIVE"
    }')
TEST_CUSTOMER_ID=$(echo "$TEST_CUSTOMER" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

TEST_PRODUCT=$(curl -s -X POST http://localhost:8080/api/v1/products \
    -H "Content-Type: application/json" \
    -d '{
        "sku": "SALES-TEST-001",
        "name": "Test Sales Product",
        "description": "For testing",
        "unitPrice": 100.00,
        "costPrice": 50.00,
        "stockQuantity": 100,
        "reorderLevel": 10,
        "status": "ACTIVE"
    }')
TEST_PRODUCT_ID=$(echo "$TEST_PRODUCT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✓${NC}"

# Create a test sales order
echo -n "Testing: Create sales order via API... "
SALES_ORDER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/sales-orders \
    -H "Content-Type: application/json" \
    -d "{
        \"customerId\": \"$TEST_CUSTOMER_ID\",
        \"orderDate\": \"2025-11-19\",
        \"deliveryDate\": \"2025-11-26\",
        \"tax\": 10.00,
        \"notes\": \"Test order\",
        \"items\": [
            {
                \"productId\": \"$TEST_PRODUCT_ID\",
                \"quantity\": 5,
                \"unitPrice\": 100.00,
                \"discount\": 0,
                \"taxRate\": 0
            }
        ]
    }")

if echo "$SALES_ORDER_RESPONSE" | grep -q '"orderNumber":"SO-'; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    SALES_ORDER_ID=$(echo "$SALES_ORDER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if [ ! -z "$SALES_ORDER_ID" ]; then
    run_test "Get sales order by ID" "curl -s http://localhost:8080/api/v1/sales-orders/$SALES_ORDER_ID | grep -q 'SO-'"
    
    run_test "Sales order has items" "curl -s http://localhost:8080/api/v1/sales-orders/$SALES_ORDER_ID | grep -q '\"items\"'"
    
    run_test "Sales order calculates total" "curl -s http://localhost:8080/api/v1/sales-orders/$SALES_ORDER_ID | grep -q '\"total\":510'"
    
    # Test status change
    echo -n "Testing: Update order status... "
    STATUS_RESPONSE=$(curl -s -X PATCH http://localhost:8080/api/v1/sales-orders/$SALES_ORDER_ID/status \
        -H "Content-Type: application/json" \
        -d '{"status": "CONFIRMED"}')
    
    if echo "$STATUS_RESPONSE" | grep -q '"status":"CONFIRMED"'; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Clean up test data
    curl -s -X DELETE "http://localhost:8080/api/v1/sales-orders/$SALES_ORDER_ID" > /dev/null 2>&1 || true
fi

# Clean up test customer and product
curl -s -X DELETE "http://localhost:8080/api/v1/customers/$TEST_CUSTOMER_ID" > /dev/null 2>&1 || true
curl -s -X DELETE "http://localhost:8080/api/v1/products/$TEST_PRODUCT_ID" > /dev/null 2>&1 || true

echo ""

# ==========================================
# Database Schema Validation
# ==========================================
echo -e "${BLUE}=========================================="
echo "Database Schema Validation"
echo "==========================================${NC}"
echo ""

run_test "Sales orders table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt sales_orders' | grep -q 'sales_orders'"

run_test "Purchase orders table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt purchase_orders' | grep -q 'purchase_orders'"

run_test "Invoices table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt invoices' | grep -q 'invoices'"

run_test "Payments table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt payments' | grep -q 'payments'"

run_test "Warehouses table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt warehouses' | grep -q 'warehouses'"

run_test "Stock movements table exists" "docker-compose exec -T postgres psql -U mulaerp -d mulaerp -c '\dt stock_movements' | grep -q 'stock_movements'"

echo ""

# ==========================================
# Frontend Validation (if running)
# ==========================================
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${BLUE}=========================================="
    echo "Frontend Validation"
    echo "==========================================${NC}"
    echo ""
    
    run_test "Frontend is accessible" "curl -s http://localhost:5173 | grep -q 'root'"
    
    run_test "React app loads" "curl -s http://localhost:5173 | grep -q 'vite'"
    
    echo ""
fi

# ==========================================
# Summary
# ==========================================
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
else
    echo -e "${GREEN}Failed: $FAILED_TESTS${NC}"
fi
echo ""

# Calculate percentage
PASS_PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

if [ $PASS_PERCENTAGE -eq 100 ]; then
    echo -e "${GREEN}=========================================="
    echo "✓ ALL TESTS PASSED! ($PASS_PERCENTAGE%)"
    echo "==========================================${NC}"
    echo ""
    echo "Phase 0, 1, 2, and 3 are fully functional!"
    echo ""
    echo "Implemented Features:"
    echo "  ✓ Infrastructure (Database, Cache, Backend)"
    echo "  ✓ Product Management"
    echo "  ✓ Customer Management"
    echo "  ✓ Supplier Management"
    echo "  ✓ Sales Order Management"
    echo ""
    echo "Ready for Phase 4!"
    exit 0
elif [ $PASS_PERCENTAGE -ge 80 ]; then
    echo -e "${YELLOW}=========================================="
    echo "⚠ MOSTLY PASSING ($PASS_PERCENTAGE%)"
    echo "==========================================${NC}"
    echo ""
    echo "Most features are working, but some tests failed."
    echo "Review the failed tests above."
    exit 1
else
    echo -e "${RED}=========================================="
    echo "✗ MULTIPLE FAILURES ($PASS_PERCENTAGE%)"
    echo "==========================================${NC}"
    echo ""
    echo "Several tests failed. Please review the output above."
    exit 1
fi
