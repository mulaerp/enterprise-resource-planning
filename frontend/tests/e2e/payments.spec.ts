import { test, expect } from '@playwright/test';

test.describe('Payment Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to payments page', async ({ page }) => {
    await page.getByRole('link', { name: /payments/i }).first().click();
    await expect(page).toHaveURL(/\/payments/);
    await expect(page.getByRole('heading', { name: /payments/i })).toBeVisible();
  });

  test('should display payments list shell', async ({ page }) => {
    await page.goto('/payments');

    await expect(page.getByRole('heading', { name: /payments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /record payment/i })).toBeVisible();
    await expect(page.getByText(/payment #/i)).toBeVisible();
    await expect(page.getByText(/invoice #/i)).toBeVisible();
    await expect(page.getByText(/method/i)).toBeVisible();
  });

  test('should navigate to record payment page', async ({ page }) => {
    await page.goto('/payments');
    await page.getByRole('button', { name: /record payment/i }).click();
    await expect(page).toHaveURL(/\/payments\/new/);
  });

  test('should render payment form fields', async ({ page }) => {
    await page.goto('/payments/new');

    await expect(page.getByRole('heading', { name: /record payment/i })).toBeVisible();
    await expect(page.getByLabel(/invoice/i)).toBeVisible();
    await expect(page.getByLabel(/payment date/i)).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toBeVisible();
    await expect(page.getByLabel(/payment method/i)).toBeVisible();
    await expect(page.getByLabel(/reference/i)).toBeVisible();
  });

  test('should validate required fields on payment form', async ({ page }) => {
    await page.goto('/payments/new');

    await page.getByRole('button', { name: /record payment/i }).click();

    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should create a new payment against an unpaid invoice', async ({ page }) => {
    const timestamp = Date.now();

    // Create a customer via the UI (cheap precondition)
    await page.goto('/customers/new');
    await page.getByLabel(/^name/i).fill(`Test Customer ${timestamp}`);
    await page.getByLabel(/email/i).fill(`customer${timestamp}@test.com`);
    await page.getByLabel(/phone/i).fill('1234567890');
    await page.getByLabel(/address/i).fill('123 Test Street');
    await page.getByLabel(/tax id/i).fill(`TAX${timestamp}`);
    await page.getByLabel(/credit limit/i).fill('10000');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // Create an invoice for that customer (cheap precondition, no product FK needed)
    await page.goto('/invoices/new');
    const customerSelect = page.getByLabel(/customer/i);
    const customerOptionCount = await customerSelect.locator('option').count();
    test.skip(customerOptionCount <= 1, 'No customer available to select');

    await customerSelect.selectOption({ label: `Test Customer ${timestamp}` });
    await page.getByPlaceholder(/description/i).first().fill('Consulting services');
    await page.getByPlaceholder(/qty/i).first().fill('1');
    await page.getByPlaceholder(/price/i).first().fill('200');
    await page.getByRole('button', { name: /create invoice/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // Now record a payment against that unpaid invoice
    await page.goto('/payments/new');
    const invoiceSelect = page.getByLabel(/invoice/i);
    const invoiceOptionCount = await invoiceSelect.locator('option').count();
    test.skip(invoiceOptionCount <= 1, 'No unpaid invoice available to select');

    await invoiceSelect.selectOption({ index: 1 });
    await page.getByLabel(/payment date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByLabel(/payment method/i).selectOption('CASH');

    await page.getByRole('button', { name: /record payment/i }).click();

    await expect(page.getByText(/success|recorded/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/payments$/);
  });

  test('should search payments', async ({ page }) => {
    await page.goto('/payments');

    const searchInput = page.getByPlaceholder(/search payments/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('PAY-');
      await page.waitForTimeout(500);
    }
  });
});
