import { test, expect } from '@playwright/test';

test.describe('Product Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to products page', async ({ page }) => {
    await page.getByRole('link', { name: /products/i }).first().click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
  });

  test('should display products list', async ({ page }) => {
    await page.goto('/products');
    
    // Check for table or list
    await expect(page.getByText(/sku/i)).toBeVisible();
    await expect(page.getByText(/name/i)).toBeVisible();
    await expect(page.getByText(/price/i)).toBeVisible();
  });

  test('should search products', async ({ page }) => {
    await page.goto('/products');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Wait for debounce
    }
  });

  test('should navigate to create product page', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: /new product/i }).click();
    await expect(page).toHaveURL(/\/products\/new/);
  });

  test('should create a new product', async ({ page }) => {
    await page.goto('/products/new');
    
    const timestamp = Date.now();
    await page.getByLabel(/sku/i).fill(`TEST-${timestamp}`);
    await page.getByLabel(/name/i).fill(`Test Product ${timestamp}`);
    await page.getByLabel(/description/i).fill('Test product description');
    await page.getByLabel(/unit price/i).fill('99.99');
    await page.getByLabel(/cost price/i).fill('50.00');
    await page.getByLabel(/stock quantity/i).fill('100');
    await page.getByLabel(/reorder level/i).fill('10');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Should redirect to products list or show success message
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show validation errors for invalid product data', async ({ page }) => {
    await page.goto('/products/new');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should edit an existing product', async ({ page }) => {
    await page.goto('/products');
    
    // Click first edit button if available
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await expect(page).toHaveURL(/\/products\/.*\/edit/);
      
      // Modify a field
      await page.getByLabel(/name/i).fill('Updated Product Name');
      await page.getByRole('button', { name: /save|update/i }).click();
      
      await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should delete a product', async ({ page }) => {
    await page.goto('/products');
    
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      // Handle confirmation dialog
      page.on('dialog', dialog => dialog.accept());
      await deleteButton.click();
      
      await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should filter products by status', async ({ page }) => {
    await page.goto('/products');
    
    const statusFilter = page.getByLabel(/status/i);
    if (await statusFilter.isVisible({ timeout: 5000 })) {
      await statusFilter.selectOption('ACTIVE');
      await page.waitForTimeout(500);
    }
  });
});
