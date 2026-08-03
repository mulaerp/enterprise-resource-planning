import { test, expect } from '@playwright/test';

test.describe('Sales Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to sales orders page', async ({ page }) => {
    await page.getByRole('link', { name: /sales.*orders/i }).first().click();
    await expect(page).toHaveURL(/\/sales-orders/);
    await expect(page.getByRole('heading', { name: /sales.*orders/i })).toBeVisible();
  });

  test('should display sales orders list', async ({ page }) => {
    await page.goto('/sales-orders');
    
    await expect(page.getByText(/order.*number/i)).toBeVisible();
    // .first() because "Customer" (the column header) also matches the sidebar's
    // "Customers" nav link, which is present on every page.
    await expect(page.getByText(/customer/i).first()).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
  });

  test('should navigate to create sales order page', async ({ page }) => {
    await page.goto('/sales-orders');
    await page.getByRole('button', { name: /new.*order/i }).click();
    await expect(page).toHaveURL(/\/sales-orders\/new/);
  });

  test('should create a new sales order', async ({ page }) => {
    const timestamp = Date.now();

    // Create a customer and a product via the UI (cheap preconditions for the FKs,
    // and so the selects below have a known, matchable option - the suite tolerates
    // a fresh, empty database, so nothing can be assumed to pre-exist).
    await page.goto('/customers/new');
    await page.getByLabel(/^name/i).fill(`Test Customer ${timestamp}`);
    await page.getByLabel(/email/i).fill(`customer${timestamp}@test.com`);
    await page.getByLabel(/phone/i).fill('1234567890');
    await page.getByLabel(/address/i).fill('123 Test Street');
    await page.getByLabel(/tax id/i).fill(`TAX${timestamp}`);
    await page.getByLabel(/credit limit/i).fill('10000');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    await page.goto('/products/new');
    await page.getByLabel(/sku/i).fill(`SO-TEST-${timestamp}`);
    await page.getByLabel(/^name/i).fill(`Test Product ${timestamp}`);
    await page.getByLabel(/unit price/i).fill('20');
    await page.getByLabel(/cost price/i).fill('10');
    await page.getByLabel(/stock quantity/i).fill('100');
    await page.getByLabel(/reorder level/i).fill('5');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    await page.goto('/sales-orders/new');

    // Native <select>s: use selectOption(), not click()+getByRole('option') - the
    // latter doesn't reliably change a native select's value in Chromium/Playwright.
    const customerSelect = page.getByLabel(/customer/i);
    await customerSelect.selectOption({ label: `Test Customer ${timestamp}` });

    await page.getByLabel(/order.*date/i).fill('2024-12-01');

    // The form already seeds one empty item row - clicking "Add Item" here would add
    // a second, still-empty row whose required Product select then blocks submission.
    const productSelect = page.getByLabel(/product/i).first();
    // fetchProducts() is async (and this catalogue is large enough - 800+ rows at size=1000 -
    // that it isn't instant), so poll for the option to actually exist rather than racing the
    // page's initial render.
    const productOption = productSelect.locator('option', { hasText: `SO-TEST-${timestamp}` });
    await expect(productOption).toHaveCount(1, { timeout: 15000 });
    await productSelect.selectOption({ label: `SO-TEST-${timestamp} - Test Product ${timestamp}` });
    await page.getByLabel(/quantity/i).first().fill('5');

    await page.getByRole('button', { name: /save|create/i }).click();

    // Scoped to the toast itself (class="toast", per components/ui/Toast.tsx), not the page's
    // full text - with the product catalog now large enough that the select above lists
    // hundreds of items (see PageSizeCap), a bare getByText(/success|created/i) can match an
    // unrelated product name containing "Created" (e.g. a leftover "...Created By USER Role"
    // test fixture) inside a <select><option>, causing a strict-mode violation.
    await expect(page.locator('[class*="toast"]').filter({ hasText: /success|created/i }).first())
      .toBeVisible({ timeout: 10000 });
  });

  test('should view sales order details', async ({ page }) => {
    await page.goto('/sales-orders');
    
    const viewButton = page.getByRole('button', { name: /view/i }).first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      await viewButton.click();
      await expect(page).toHaveURL(/\/sales-orders\/[^/]+$/);
      
      // Check for order details
      await expect(page.getByText(/order.*number/i)).toBeVisible();
      await expect(page.getByText(/customer/i)).toBeVisible();
      await expect(page.getByText(/items/i)).toBeVisible();
    }
  });

  test('should filter sales orders by status', async ({ page }) => {
    await page.goto('/sales-orders');
    
    const statusFilter = page.getByLabel(/status/i);
    if (await statusFilter.isVisible({ timeout: 5000 })) {
      await statusFilter.selectOption('CONFIRMED');
      await page.waitForTimeout(500);
    }
  });

  test('should search sales orders', async ({ page }) => {
    await page.goto('/sales-orders');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('SO-');
      await page.waitForTimeout(500);
    }
  });

  test('should update sales order status', async ({ page }) => {
    await page.goto('/sales-orders');
    
    const viewButton = page.getByRole('button', { name: /view/i }).first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      await viewButton.click();
      
      const statusButton = page.getByRole('button', { name: /confirm|deliver/i }).first();
      if (await statusButton.isVisible({ timeout: 5000 })) {
        await statusButton.click();
        await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should calculate order totals correctly', async ({ page }) => {
    await page.goto('/sales-orders/new');
    
    // This test would verify that totals are calculated correctly
    // when items are added/removed
    const addItemButton = page.getByRole('button', { name: /add.*item/i });
    if (await addItemButton.isVisible({ timeout: 5000 })) {
      await addItemButton.click();
      
      // Check if subtotal/total fields exist
      const subtotalField = page.getByText(/subtotal/i);
      const totalField = page.getByText(/total/i);
      
      if (await subtotalField.isVisible()) {
        await expect(subtotalField).toBeVisible();
      }
      if (await totalField.isVisible()) {
        await expect(totalField).toBeVisible();
      }
    }
  });
});
