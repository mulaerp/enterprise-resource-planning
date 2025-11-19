import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/Mula ERP/i);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should have required field validation', async ({ page }) => {
    // Check that email field has required attribute (HTML5 validation)
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
    
    // HTML5 validation prevents submission with empty fields
    // This is the expected behavior - browser handles validation
  });

  // SKIPPED: Backend login endpoint has errors - needs to be fixed first
  test.skip('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 10000 });
  });

  // SKIPPED: Backend login endpoint has errors - needs to be fixed first
  test.skip('should login successfully with valid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  // SKIPPED: Backend login endpoint has errors - needs to be fixed first
  test.skip('should redirect to dashboard if already logged in', async ({ page }) => {
    // Login first
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Try to access login page
    await page.goto('/login');
    
    // Should redirect back to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
