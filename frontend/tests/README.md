# E2E Testing with Playwright

This directory contains end-to-end tests for the Mula ERP frontend application using Playwright.

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test auth.spec.ts
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

```
tests/
├── e2e/                      # E2E test files
│   ├── auth.spec.ts         # Authentication tests
│   ├── products.spec.ts     # Product management tests
│   ├── customers.spec.ts    # Customer management tests
│   ├── suppliers.spec.ts    # Supplier management tests
│   ├── sales-orders.spec.ts # Sales order tests
│   ├── dashboard.spec.ts    # Dashboard tests
│   ├── reports.spec.ts      # Reports tests
│   ├── navigation.spec.ts   # Navigation tests
│   ├── notifications.spec.ts # Notification tests
│   └── search.spec.ts       # Search functionality tests
├── helpers/                  # Test helpers
│   ├── auth.ts              # Authentication helpers
│   └── test-data.ts         # Test data generators
└── README.md                # This file
```

## Test Coverage

### Authentication (`auth.spec.ts`)
- ✅ Display login page
- ✅ Validation errors
- ✅ Invalid credentials
- ✅ Successful login
- ✅ Redirect when authenticated

### Products (`products.spec.ts`)
- ✅ List products
- ✅ Search products
- ✅ Create product
- ✅ Edit product
- ✅ Delete product
- ✅ Validation
- ✅ Filter by status

### Customers (`customers.spec.ts`)
- ✅ List customers
- ✅ Create customer
- ✅ Edit customer
- ✅ Search customers
- ✅ Validation (required fields, email format)

### Suppliers (`suppliers.spec.ts`)
- ✅ List suppliers
- ✅ Create supplier
- ✅ Edit supplier
- ✅ Delete supplier
- ✅ Search suppliers

### Sales Orders (`sales-orders.spec.ts`)
- ✅ List sales orders
- ✅ Create sales order
- ✅ View order details
- ✅ Update order status
- ✅ Filter by status
- ✅ Search orders
- ✅ Calculate totals

### Dashboard (`dashboard.spec.ts`)
- ✅ Display metrics
- ✅ Display charts
- ✅ Navigation links
- ✅ Notifications
- ✅ Global search
- ✅ User menu
- ✅ Low stock alerts

### Reports (`reports.spec.ts`)
- ✅ Navigate to reports
- ✅ Sales report
- ✅ Inventory report
- ✅ Filter by date range
- ✅ Export reports
- ✅ Filter by category

### Navigation (`navigation.spec.ts`)
- ✅ Sidebar navigation
- ✅ Navigate all sections
- ✅ Active item highlighting
- ✅ Breadcrumbs
- ✅ Browser back/forward
- ✅ Auth redirect
- ✅ Logout
- ✅ 404 handling

### Notifications (`notifications.spec.ts`)
- ✅ Display notification bell
- ✅ Notification count badge
- ✅ Open notification panel
- ✅ Mark as read
- ✅ Mark all as read
- ✅ Filter notifications
- ✅ Toast notifications
- ✅ Auto-dismiss toasts

### Search (`search.spec.ts`)
- ✅ Global search
- ✅ Search results by category
- ✅ Navigate to result
- ✅ No results message
- ✅ Clear on escape
- ✅ Keyboard navigation
- ✅ Page-specific search
- ✅ Combine search with filters

## Prerequisites

Before running tests, ensure:

1. **Backend is running**: The backend API must be accessible at `http://localhost:8080`
2. **Database is seeded**: Default admin user exists (admin@mulaerp.com / admin123)
3. **Frontend dev server**: Tests will automatically start the dev server on port 5173

## Configuration

Test configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173`
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Browsers**: Chromium, Firefox, WebKit
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry

## Writing Tests

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for elements**: Use `expect().toBeVisible()` instead of `waitForTimeout` when possible
3. **Isolate tests**: Each test should be independent
4. **Use helpers**: Reuse authentication and test data helpers
5. **Handle async**: Always await Playwright actions
6. **Clean up**: Tests should clean up created data (or use soft deletes)

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { generateProductData } from '../helpers/test-data';

test.describe('Product Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should create a product', async ({ page }) => {
    await page.goto('/products/new');
    
    const product = generateProductData();
    await page.getByLabel(/sku/i).fill(product.sku);
    await page.getByLabel(/name/i).fill(product.name);
    // ... fill other fields
    
    await page.getByRole('button', { name: /save/i }).click();
    
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

## Debugging

### Debug a specific test
```bash
npx playwright test auth.spec.ts --debug
```

### View test report
```bash
npx playwright show-report
```

### Generate trace
```bash
npx playwright test --trace on
```

### View trace
```bash
npx playwright show-trace trace.zip
```

## CI/CD Integration

Tests are configured to run in CI with:
- Retries enabled (2 retries)
- Single worker (sequential execution)
- HTML report generation
- Screenshots and videos on failure

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if backend is running
- Check network connectivity

### Elements not found
- Use `--headed` mode to see what's happening
- Check if selectors match the actual UI
- Verify element is visible before interacting

### Flaky tests
- Add proper waits (`waitForLoadState`, `waitForURL`)
- Use `toBeVisible()` instead of `waitForTimeout`
- Ensure test isolation

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
