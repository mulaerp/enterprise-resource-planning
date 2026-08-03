import { test, expect } from '@playwright/test';

// Inventory sub-pages (stock adjustments, batches, serials, transfers) are not
// linked from the main sidebar (see Layout.tsx navItems), so these tests
// navigate to them directly by URL rather than via a nav link click.

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.describe('Stock Adjustments', () => {
    test('should display stock adjustments list shell', async ({ page }) => {
      await page.goto('/inventory/adjustments');

      await expect(page.getByRole('heading', { name: /stock adjustments/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new adjustment/i })).toBeVisible();
      await expect(page.getByText(/adjustment #/i)).toBeVisible();
      await expect(page.getByText(/^product$/i)).toBeVisible();
    });

    test('should navigate to create stock adjustment page', async ({ page }) => {
      await page.goto('/inventory/adjustments');
      await page.getByRole('button', { name: /new adjustment/i }).click();
      await expect(page).toHaveURL(/\/inventory\/adjustments\/new/);
    });

    test('should render stock adjustment form fields and validate required fields', async ({ page }) => {
      await page.goto('/inventory/adjustments/new');

      await expect(page.getByRole('heading', { name: /new stock adjustment/i })).toBeVisible();
      await expect(page.getByLabel(/^product/i)).toBeVisible();
      await expect(page.getByLabel(/warehouse/i)).toBeVisible();
      await expect(page.getByLabel(/adjustment type/i)).toBeVisible();
      await expect(page.getByLabel(/quantity/i)).toBeVisible();
      await expect(page.getByLabel(/reason/i)).toBeVisible();

      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test('should create a stock adjustment for a product', async ({ page }) => {
      const timestamp = Date.now();

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

      await page.goto('/inventory/adjustments/new');
      const productSelect = page.getByLabel(/^product/i);
      const productOptionCount = await productSelect.locator('option').count();
      test.skip(productOptionCount <= 1, 'No product available to select');

      await productSelect.selectOption({ label: `Test Product ${timestamp} (Current: 100)` });
      await page.getByLabel(/warehouse/i).selectOption({ index: 1 });
      await page.getByLabel(/adjustment type/i).selectOption('INCREASE');
      await page.getByLabel(/quantity/i).fill('10');
      await page.getByLabel(/reason/i).fill('E2E test stock count correction');

      await page.getByRole('button', { name: /^save$/i }).click();

      await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/inventory\/adjustments$/);
    });
  });

  test.describe('Batch/Lot Tracking', () => {
    test('should display batches list shell', async ({ page }) => {
      await page.goto('/inventory/batches');

      await expect(page.getByRole('heading', { name: /batch.*lot tracking/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new batch/i })).toBeVisible();
      await expect(page.getByText(/batch number/i)).toBeVisible();
    });

    test('should navigate to create batch page', async ({ page }) => {
      await page.goto('/inventory/batches');
      await page.getByRole('button', { name: /new batch/i }).click();
      await expect(page).toHaveURL(/\/inventory\/batches\/new/);
    });

    test('should render batch form fields and validate required fields', async ({ page }) => {
      await page.goto('/inventory/batches/new');

      await expect(page.getByRole('heading', { name: /new batch/i })).toBeVisible();
      await expect(page.getByLabel(/^product/i)).toBeVisible();
      await expect(page.getByLabel(/batch number/i)).toBeVisible();
      await expect(page.getByLabel(/manufacture date/i)).toBeVisible();
      await expect(page.getByLabel(/expiry date/i)).toBeVisible();
      await expect(page.getByLabel(/quantity/i)).toBeVisible();

      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });
  });

  test.describe('Serial Number Tracking', () => {
    test('should display serials list shell', async ({ page }) => {
      await page.goto('/inventory/serials');

      await expect(page.getByRole('heading', { name: /serial number tracking/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new serial number/i })).toBeVisible();
      await expect(page.getByText(/serial number/i).first()).toBeVisible();
    });

    test('should navigate to create serial number page', async ({ page }) => {
      await page.goto('/inventory/serials');
      await page.getByRole('button', { name: /new serial number/i }).click();
      await expect(page).toHaveURL(/\/inventory\/serials\/new/);
    });

    test('should render serial number form fields and validate required fields', async ({ page }) => {
      await page.goto('/inventory/serials/new');

      await expect(page.getByRole('heading', { name: /new serial number/i })).toBeVisible();
      await expect(page.getByLabel(/^product/i)).toBeVisible();
      await expect(page.getByLabel(/serial number/i)).toBeVisible();
      await expect(page.getByLabel(/purchase date/i)).toBeVisible();
      await expect(page.getByLabel(/warranty expiry date/i)).toBeVisible();

      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });
  });

  test.describe('Stock Transfers', () => {
    test('should display stock transfers list shell', async ({ page }) => {
      await page.goto('/inventory/transfers');

      await expect(page.getByRole('heading', { name: /stock transfers/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new transfer/i })).toBeVisible();
      await expect(page.getByText(/transfer #/i)).toBeVisible();
      await expect(page.getByText(/from warehouse/i)).toBeVisible();
      await expect(page.getByText(/to warehouse/i)).toBeVisible();
    });

    test('should navigate to create stock transfer page', async ({ page }) => {
      await page.goto('/inventory/transfers');
      await page.getByRole('button', { name: /new transfer/i }).click();
      await expect(page).toHaveURL(/\/inventory\/transfers\/new/);
    });

    test('should render stock transfer form fields and validate required fields', async ({ page }) => {
      await page.goto('/inventory/transfers/new');

      await expect(page.getByRole('heading', { name: /new stock transfer/i })).toBeVisible();
      await expect(page.getByLabel(/from warehouse/i)).toBeVisible();
      await expect(page.getByLabel(/to warehouse/i)).toBeVisible();
      await expect(page.getByLabel(/transfer date/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /add item/i })).toBeVisible();

      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });
  });
});
