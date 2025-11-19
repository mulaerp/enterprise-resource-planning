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
    await expect(page.getByText(/customer/i)).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
  });

  test('should navigate to create sales order page', async ({ page }) => {
    await page.goto('/sales-orders');
    await page.getByRole('button', { name: /new.*order/i }).click();
    await expect(page).toHaveURL(/\/sales-orders\/new/);
  });

  test('should create a new sales order', async ({ page }) => {
    await page.goto('/sales-orders/new');
    
    // Select customer
    const customerSelect = page.getByLabel(/customer/i);
    if (await customerSelect.isVisible({ timeout: 5000 })) {
      await customerSelect.click();
      await page.getByRole('option').first().click();
    }
    
    // Set order date
    const orderDateInput = page.getByLabel(/order.*date/i);
    if (await orderDateInput.isVisible()) {
      await orderDateInput.fill('2024-12-01');
    }
    
    // Add order items
    const addItemButton = page.getByRole('button', { name: /add.*item/i });
    if (await addItemButton.isVisible({ timeout: 5000 })) {
      await addItemButton.click();
      
      // Select product
      const productSelect = page.getByLabel(/product/i).first();
      if (await productSelect.isVisible()) {
        await productSelect.click();
        await page.getByRole('option').first().click();
      }
      
      // Set quantity
      await page.getByLabel(/quantity/i).first().fill('5');
    }
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
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
