import { test, expect } from '@playwright/test';

test.describe('Supplier Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to suppliers page', async ({ page }) => {
    await page.getByRole('link', { name: /suppliers/i }).first().click();
    await expect(page).toHaveURL(/\/suppliers/);
    await expect(page.getByRole('heading', { name: /suppliers/i })).toBeVisible();
  });

  test('should display suppliers list', async ({ page }) => {
    await page.goto('/suppliers');
    
    await expect(page.getByText(/name/i)).toBeVisible();
    await expect(page.getByText(/email/i)).toBeVisible();
  });

  test('should create a new supplier', async ({ page }) => {
    await page.goto('/suppliers/new');
    
    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Test Supplier ${timestamp}`);
    await page.getByLabel(/email/i).fill(`supplier${timestamp}@test.com`);
    await page.getByLabel(/phone/i).fill('1234567890');
    await page.getByLabel(/address/i).fill('456 Supplier Avenue');
    await page.getByLabel(/tax id/i).fill(`STAX${timestamp}`);
    await page.getByLabel(/payment terms/i).fill('Net 30');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
  });

  test('should search suppliers', async ({ page }) => {
    await page.goto('/suppliers');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('should edit a supplier', async ({ page }) => {
    await page.goto('/suppliers');
    
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await expect(page).toHaveURL(/\/suppliers\/.*\/edit/);
      
      await page.getByLabel(/payment terms/i).fill('Net 60');
      await page.getByRole('button', { name: /save|update/i }).click();
      
      await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should delete a supplier', async ({ page }) => {
    await page.goto('/suppliers');
    
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      page.on('dialog', dialog => dialog.accept());
      await deleteButton.click();
      
      await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 10000 });
    }
  });
});
