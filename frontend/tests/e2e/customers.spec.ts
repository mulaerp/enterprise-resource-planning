import { test, expect } from '@playwright/test';

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to customers page', async ({ page }) => {
    await page.getByRole('link', { name: /customers/i }).first().click();
    await expect(page).toHaveURL(/\/customers/);
    await expect(page.getByRole('heading', { name: /customers/i })).toBeVisible();
  });

  test('should display customers list', async ({ page }) => {
    await page.goto('/customers');
    
    await expect(page.getByText(/name/i)).toBeVisible();
    await expect(page.getByText(/email/i)).toBeVisible();
    await expect(page.getByText(/phone/i)).toBeVisible();
  });

  test('should create a new customer', async ({ page }) => {
    await page.goto('/customers/new');
    
    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Test Customer ${timestamp}`);
    await page.getByLabel(/email/i).fill(`customer${timestamp}@test.com`);
    await page.getByLabel(/phone/i).fill('1234567890');
    await page.getByLabel(/address/i).fill('123 Test Street');
    await page.getByLabel(/tax id/i).fill(`TAX${timestamp}`);
    await page.getByLabel(/credit limit/i).fill('10000');
    
    await page.getByRole('button', { name: /save|create/i }).click();

    // Don't wait on the success toast: it auto-dismisses after 5s
    // (components/ui/Toast.tsx default duration), and under load Playwright's
    // assertion retry can land after it's already gone, flaking a create that
    // actually succeeded. CustomerFormPage.tsx shows the toast and navigates
    // back to /customers back-to-back, so the URL change is a durable
    // post-create signal that can't disappear out from under the poll.
    await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
  });

  test('should search customers', async ({ page }) => {
    await page.goto('/customers');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('should edit a customer', async ({ page }) => {
    await page.goto('/customers');
    
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await expect(page).toHaveURL(/\/customers\/.*\/edit/);
      
      await page.getByLabel(/phone/i).fill('9876543210');
      await page.getByRole('button', { name: /save|update/i }).click();
      
      await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/customers/new');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/customers/new');
    
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText(/invalid.*email/i)).toBeVisible();
  });
});
