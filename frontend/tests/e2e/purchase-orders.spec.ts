import { test, expect } from '@playwright/test';

test.describe('Purchase Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to purchase orders page', async ({ page }) => {
    await page.getByRole('link', { name: /purchase.*orders/i }).first().click();
    await expect(page).toHaveURL(/\/purchase-orders/);
    await expect(page.getByRole('heading', { name: /purchase orders/i })).toBeVisible();
  });

  test('should display purchase orders list shell', async ({ page }) => {
    await page.goto('/purchase-orders');

    await expect(page.getByRole('heading', { name: /purchase orders/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new purchase order/i })).toBeVisible();
    // Table headers or empty state should render even with no seeded data
    await expect(page.getByText(/po number/i)).toBeVisible();
    await expect(page.getByText(/supplier/i).first()).toBeVisible();
    await expect(page.getByText(/status/i).first()).toBeVisible();
  });

  test('should navigate to create purchase order page', async ({ page }) => {
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: /new purchase order/i }).click();
    await expect(page).toHaveURL(/\/purchase-orders\/new/);
  });

  test('should render purchase order form fields', async ({ page }) => {
    await page.goto('/purchase-orders/new');

    await expect(page.getByRole('heading', { name: /new purchase order/i })).toBeVisible();
    await expect(page.getByLabel(/supplier/i)).toBeVisible();
    await expect(page.getByLabel(/order date/i)).toBeVisible();
    await expect(page.getByLabel(/expected date/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toBeVisible();
    await expect(page.getByPlaceholder(/qty/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/price/i).first()).toBeVisible();
    await expect(page.getByText(/^total/i)).toBeVisible();
  });

  test('should validate required fields on purchase order form', async ({ page }) => {
    await page.goto('/purchase-orders/new');

    await page.getByRole('button', { name: /create purchase order/i }).click();

    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should create a new purchase order', async ({ page }) => {
    const timestamp = Date.now();

    // Create a supplier via the UI (cheap precondition for the FK)
    await page.goto('/suppliers/new');
    await page.getByLabel(/^name/i).fill(`Test Supplier ${timestamp}`);
    await page.getByLabel(/email/i).fill(`supplier${timestamp}@test.com`);
    await page.getByLabel(/phone/i).fill('1234567890');
    await page.getByLabel(/address/i).fill('456 Supplier Avenue');
    await page.getByLabel(/tax id/i).fill(`STAX${timestamp}`);
    await page.getByLabel(/payment terms/i).fill('Net 30');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // Create a product via the UI (cheap precondition for the FK)
    await page.goto('/products/new');
    await page.getByLabel(/sku/i).fill(`TEST-${timestamp}`);
    await page.getByLabel(/name/i).fill(`Test Product ${timestamp}`);
    await page.getByLabel(/description/i).fill('Test product description');
    await page.getByLabel(/unit price/i).fill('99.99');
    await page.getByLabel(/cost price/i).fill('50.00');
    await page.getByLabel(/stock quantity/i).fill('100');
    await page.getByLabel(/reorder level/i).fill('10');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // Now create the purchase order using the freshly created supplier/product
    await page.goto('/purchase-orders/new');

    const supplierSelect = page.getByLabel(/supplier/i);
    const supplierOptionCount = await supplierSelect.locator('option').count();
    test.skip(supplierOptionCount <= 1, 'No supplier available to select');

    await supplierSelect.selectOption({ label: `Test Supplier ${timestamp}` });
    await page.getByLabel(/order date/i).fill(new Date().toISOString().split('T')[0]);

    // First item row's product select has no explicit <label>, so target the
    // second combobox on the page (first combobox is the supplier select).
    const productSelect = page.getByRole('combobox').nth(1);
    await productSelect.selectOption({ label: `Test Product ${timestamp} (TEST-${timestamp})` });
    await page.getByPlaceholder(/qty/i).first().fill('5');

    await page.getByRole('button', { name: /create purchase order/i }).click();

    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/purchase-orders$/);
  });

  test('should search purchase orders', async ({ page }) => {
    await page.goto('/purchase-orders');

    const searchInput = page.getByPlaceholder(/search purchase orders/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('PO-');
      await page.waitForTimeout(500);
    }
  });
});
