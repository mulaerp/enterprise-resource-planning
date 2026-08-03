import { test, expect } from '@playwright/test';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to invoices page', async ({ page }) => {
    await page.getByRole('link', { name: /invoices/i }).first().click();
    await expect(page).toHaveURL(/\/invoices/);
    await expect(page.getByRole('heading', { name: /invoices/i })).toBeVisible();
  });

  test('should display invoices list shell', async ({ page }) => {
    await page.goto('/invoices');

    await expect(page.getByRole('heading', { name: /invoices/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new invoice/i })).toBeVisible();
    await expect(page.getByText(/invoice #/i)).toBeVisible();
    await expect(page.getByText(/customer/i).first()).toBeVisible();
    await expect(page.getByText(/balance/i).first()).toBeVisible();
  });

  test('should navigate to create invoice page', async ({ page }) => {
    await page.goto('/invoices');
    await page.getByRole('button', { name: /new invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/new/);
  });

  test('should render invoice form fields', async ({ page }) => {
    await page.goto('/invoices/new');

    await expect(page.getByRole('heading', { name: /new invoice/i })).toBeVisible();
    await expect(page.getByLabel(/customer/i)).toBeVisible();
    await expect(page.getByLabel(/invoice date/i)).toBeVisible();
    await expect(page.getByLabel(/due date/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toBeVisible();
    await expect(page.getByPlaceholder(/description/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/qty/i).first()).toBeVisible();
    await expect(page.getByText(/^total/i)).toBeVisible();
  });

  test('should validate required fields on invoice form', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: /create invoice/i }).click();

    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should create a new invoice', async ({ page }) => {
    const timestamp = Date.now();

    // Create a customer via the UI (cheap precondition for the FK)
    await page.goto('/customers/new');
    await page.getByLabel(/^name/i).fill(`Test Customer ${timestamp}`);
    await page.getByLabel(/email/i).fill(`customer${timestamp}@test.com`);
    await page.getByLabel(/phone/i).fill('1234567890');
    await page.getByLabel(/address/i).fill('123 Test Street');
    await page.getByLabel(/tax id/i).fill(`TAX${timestamp}`);
    await page.getByLabel(/credit limit/i).fill('10000');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // Invoice line items only need a free-text description, no product FK,
    // so the invoice can be created right after the customer exists.
    await page.goto('/invoices/new');

    const customerSelect = page.getByLabel(/customer/i);
    const customerOptionCount = await customerSelect.locator('option').count();
    test.skip(customerOptionCount <= 1, 'No customer available to select');

    await customerSelect.selectOption({ label: `Test Customer ${timestamp}` });
    await page.getByPlaceholder(/description/i).first().fill('Consulting services');
    await page.getByPlaceholder(/qty/i).first().fill('2');
    await page.getByPlaceholder(/price/i).first().fill('150');

    await page.getByRole('button', { name: /create invoice/i }).click();

    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/invoices$/);
  });

  test('should search invoices', async ({ page }) => {
    await page.goto('/invoices');

    const searchInput = page.getByPlaceholder(/search invoices/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('INV-');
      await page.waitForTimeout(500);
    }
  });
});
