---
inclusion: always
---

# E2E Testing Guide with Playwright

## Overview

Mula ERP uses Playwright for end-to-end testing of the frontend application. All E2E tests are located in `frontend/tests/e2e/` and follow consistent patterns for maintainability and reliability.

## Test Structure

```
frontend/
├── tests/
│   ├── e2e/                    # E2E test specifications
│   │   ├── auth.spec.ts       # Authentication flows
│   │   ├── products.spec.ts   # Product management
│   │   ├── customers.spec.ts  # Customer management
│   │   ├── suppliers.spec.ts  # Supplier management
│   │   ├── sales-orders.spec.ts # Sales order workflows
│   │   ├── dashboard.spec.ts  # Dashboard features
│   │   ├── reports.spec.ts    # Reporting functionality
│   │   ├── navigation.spec.ts # Navigation & routing
│   │   ├── notifications.spec.ts # Notification system
│   │   └── search.spec.ts     # Search functionality
│   ├── helpers/               # Reusable test utilities
│   │   ├── auth.ts           # Authentication helpers
│   │   └── test-data.ts      # Test data generators
│   └── README.md             # Testing documentation
├── playwright.config.ts       # Playwright configuration
└── package.json              # Test scripts
```

## Running Tests

### Prerequisites
1. Backend must be running on `http://localhost:8080`
2. Database must be seeded with default admin user
3. Frontend dependencies installed (`npm install`)
4. Playwright browsers installed (`npx playwright install`)

### Commands

```bash
# Run all tests
npm run test:e2e

# Interactive UI mode (recommended for development)
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test auth.spec.ts

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# View test report
npx playwright show-report

# Convenience script (checks backend first)
./scripts/run-e2e-tests.sh [ui|headed|debug|chromium|firefox|webkit|report]
```

## Writing Tests

### Best Practices

#### 1. Use Semantic Selectors
Prefer accessible selectors over CSS selectors:

```typescript
// ✅ GOOD - Semantic and accessible
await page.getByRole('button', { name: /sign in/i });
await page.getByLabel(/email/i);
await page.getByText(/dashboard/i);
await page.getByPlaceholder(/search/i);

// ❌ BAD - Brittle CSS selectors
await page.locator('.btn-primary');
await page.locator('#email-input');
```

#### 2. Handle Authentication
Use the auth helper for consistent login:

```typescript
import { login } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await login(page);
});
```

#### 3. Use Test Data Generators
Generate unique test data to avoid conflicts:

```typescript
import { generateProductData } from '../helpers/test-data';

test('should create product', async ({ page }) => {
  const product = generateProductData();
  await page.getByLabel(/sku/i).fill(product.sku);
  await page.getByLabel(/name/i).fill(product.name);
  // ...
});
```

#### 4. Wait for Elements Properly
Use assertions instead of arbitrary timeouts:

```typescript
// ✅ GOOD - Wait for element to be visible
await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

// ❌ BAD - Arbitrary timeout
await page.waitForTimeout(5000);
```

#### 5. Handle Optional Elements
Check visibility before interacting:

```typescript
const searchInput = page.getByPlaceholder(/search/i);
if (await searchInput.isVisible({ timeout: 5000 })) {
  await searchInput.fill('test');
}
```

#### 6. Test Isolation
Each test should be independent:

```typescript
test.describe('Products', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/products');
  });

  test('should create product', async ({ page }) => {
    // Test creates its own data
    // Test cleans up after itself (or uses soft deletes)
  });
});
```

#### 7. Handle Dialogs
Set up dialog handlers before triggering:

```typescript
page.on('dialog', dialog => dialog.accept());
await page.getByRole('button', { name: /delete/i }).click();
```

#### 8. Test User Flows, Not Implementation
Focus on what users do, not how it's implemented:

```typescript
// ✅ GOOD - Tests user flow
test('should complete checkout', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: /add to cart/i }).click();
  await page.goto('/cart');
  await page.getByRole('button', { name: /checkout/i }).click();
  await expect(page.getByText(/order confirmed/i)).toBeVisible();
});

// ❌ BAD - Tests implementation details
test('should update cart state', async ({ page }) => {
  // Testing internal state management
});
```

## Test Patterns

### Standard CRUD Test Pattern

```typescript
test.describe('Entity Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should list entities', async ({ page }) => {
    await page.goto('/entities');
    await expect(page.getByRole('heading', { name: /entities/i })).toBeVisible();
    await expect(page.getByText(/name/i)).toBeVisible();
  });

  test('should create entity', async ({ page }) => {
    await page.goto('/entities/new');
    
    const data = generateEntityData();
    await page.getByLabel(/name/i).fill(data.name);
    // Fill other fields...
    
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
  });

  test('should edit entity', async ({ page }) => {
    await page.goto('/entities');
    
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await expect(page).toHaveURL(/\/entities\/.*\/edit/);
      
      await page.getByLabel(/name/i).fill('Updated Name');
      await page.getByRole('button', { name: /save|update/i }).click();
      
      await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should delete entity', async ({ page }) => {
    await page.goto('/entities');
    
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      page.on('dialog', dialog => dialog.accept());
      await deleteButton.click();
      
      await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should search entities', async ({ page }) => {
    await page.goto('/entities');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Debounce
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/entities/new');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });
});
```

### Form Validation Pattern

```typescript
test('should validate form fields', async ({ page }) => {
  await page.goto('/form-page');
  
  // Test required fields
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/required/i).first()).toBeVisible();
  
  // Test email format
  await page.getByLabel(/email/i).fill('invalid-email');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/invalid.*email/i)).toBeVisible();
  
  // Test number range
  await page.getByLabel(/quantity/i).fill('-1');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/must be positive/i)).toBeVisible();
});
```

### Navigation Pattern

```typescript
test('should navigate through sections', async ({ page }) => {
  const sections = [
    { name: /dashboard/i, url: /\/dashboard/ },
    { name: /products/i, url: /\/products/ },
    { name: /customers/i, url: /\/customers/ },
  ];

  for (const section of sections) {
    const link = page.getByRole('link', { name: section.name }).first();
    if (await link.isVisible({ timeout: 2000 })) {
      await link.click();
      await expect(page).toHaveURL(section.url);
    }
  }
});
```

### Search Pattern

```typescript
test('should search and filter', async ({ page }) => {
  await page.goto('/list-page');
  
  // Search
  const searchInput = page.getByPlaceholder(/search/i);
  if (await searchInput.isVisible()) {
    await searchInput.fill('test query');
    await page.waitForTimeout(500); // Debounce
  }
  
  // Filter
  const statusFilter = page.getByLabel(/status/i);
  if (await statusFilter.isVisible()) {
    await statusFilter.selectOption('ACTIVE');
    await page.waitForTimeout(500);
  }
});
```

## Configuration

### Playwright Config (`playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Key Settings

- **Base URL**: `http://localhost:5173` (Vite dev server)
- **Retries**: 2 in CI, 0 locally
- **Parallel**: Tests run in parallel (except in CI)
- **Trace**: Captured on first retry for debugging
- **Screenshots/Videos**: Only on failure
- **Browsers**: Chrome, Firefox, Safari

## Debugging

### Debug Specific Test
```bash
npx playwright test auth.spec.ts --debug
```

### View Trace
```bash
npx playwright show-trace trace.zip
```

### Headed Mode
```bash
npm run test:e2e:headed
```

### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Console Logging
```typescript
test('debug test', async ({ page }) => {
  page.on('console', msg => console.log('Browser:', msg.text()));
  // Your test code
});
```

## Common Issues & Solutions

### Issue: Tests Timing Out
**Solution**: 
- Increase timeout: `{ timeout: 30000 }`
- Check if backend is running
- Use proper waits instead of `waitForTimeout`

### Issue: Element Not Found
**Solution**:
- Run in headed mode to see UI
- Check selector matches actual element
- Verify element is visible before interacting
- Use `page.pause()` to inspect

### Issue: Flaky Tests
**Solution**:
- Add proper waits (`waitForLoadState`, `waitForURL`)
- Use `toBeVisible()` instead of `waitForTimeout`
- Ensure test isolation
- Check for race conditions

### Issue: Authentication Failing
**Solution**:
- Verify backend is running
- Check default admin user exists in database
- Clear browser storage between tests
- Use auth helper consistently

## CI/CD Integration

Tests are configured for CI with:
- **Retries**: 2 retries on failure
- **Workers**: Single worker (sequential)
- **Reporter**: HTML report
- **Artifacts**: Screenshots, videos, traces on failure

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Wait for backend
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:8080/api/v1/health; do sleep 2; done'
      
      - name: Run tests
        run: cd frontend && npm run test:e2e
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## Test Coverage Goals

### Current Coverage
- ✅ Authentication (login, logout, validation)
- ✅ Product Management (CRUD, search, filter)
- ✅ Customer Management (CRUD, validation)
- ✅ Supplier Management (CRUD)
- ✅ Sales Orders (create, view, update status)
- ✅ Dashboard (metrics, charts, navigation)
- ✅ Reports (sales, inventory, export)
- ✅ Navigation (routing, breadcrumbs)
- ✅ Notifications (bell, toasts)
- ✅ Search (global, page-specific)

### Future Coverage
- ⏳ Purchase Orders
- ⏳ Invoicing
- ⏳ Payments
- ⏳ User Management
- ⏳ Settings
- ⏳ Accounting
- ⏳ Mobile Responsive Tests
- ⏳ Accessibility Tests

## Performance Testing

### Load Time Tests
```typescript
test('should load dashboard quickly', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(3000); // 3 seconds
});
```

### Network Monitoring
```typescript
test('should make minimal API calls', async ({ page }) => {
  const requests: string[] = [];
  
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      requests.push(request.url());
    }
  });
  
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  expect(requests.length).toBeLessThan(10);
});
```

## Accessibility Testing

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('should be accessible', async ({ page }) => {
  await page.goto('/dashboard');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Visual Regression Testing

```typescript
test('should match screenshot', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

## Maintenance

### Regular Tasks
1. **Update selectors** when UI changes
2. **Add tests** for new features
3. **Remove tests** for deprecated features
4. **Review flaky tests** and fix root causes
5. **Update test data** generators as schema changes
6. **Keep Playwright updated**: `npm update @playwright/test`

### Code Review Checklist
- [ ] Tests follow naming conventions
- [ ] Tests use semantic selectors
- [ ] Tests are isolated and independent
- [ ] Tests have proper waits (no arbitrary timeouts)
- [ ] Tests handle optional elements gracefully
- [ ] Tests use helper functions where appropriate
- [ ] Tests have meaningful assertions
- [ ] Tests are documented if complex

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)

## Quick Reference

### Common Selectors
```typescript
page.getByRole('button', { name: /text/i })
page.getByLabel(/label text/i)
page.getByText(/text/i)
page.getByPlaceholder(/placeholder/i)
page.getByTestId('test-id')
```

### Common Assertions
```typescript
await expect(element).toBeVisible()
await expect(element).toBeHidden()
await expect(element).toHaveText(/text/i)
await expect(element).toHaveValue('value')
await expect(page).toHaveURL(/pattern/)
await expect(page).toHaveTitle(/title/i)
```

### Common Actions
```typescript
await element.click()
await element.fill('text')
await element.selectOption('value')
await element.check()
await element.press('Enter')
await page.goto('/path')
await page.goBack()
await page.reload()
```
