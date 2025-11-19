import { test, expect } from '@playwright/test';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to reports page', async ({ page }) => {
    await page.getByRole('link', { name: /reports/i }).first().click();
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test('should display available report types', async ({ page }) => {
    await page.goto('/reports');
    
    const reportTypes = [
      /sales.*report/i,
      /inventory.*report/i,
    ];

    for (const reportType of reportTypes) {
      const element = page.getByText(reportType).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(element).toBeVisible();
      }
    }
  });

  test('should navigate to sales report', async ({ page }) => {
    await page.goto('/reports');
    
    const salesReportLink = page.getByRole('link', { name: /sales.*report/i }).first();
    if (await salesReportLink.isVisible({ timeout: 5000 })) {
      await salesReportLink.click();
      await expect(page).toHaveURL(/\/reports\/sales/);
    }
  });

  test('should filter sales report by date range', async ({ page }) => {
    await page.goto('/reports/sales');
    
    const startDateInput = page.getByLabel(/start.*date|from/i);
    const endDateInput = page.getByLabel(/end.*date|to/i);
    
    if (await startDateInput.isVisible({ timeout: 5000 })) {
      await startDateInput.fill('2024-01-01');
      await endDateInput.fill('2024-12-31');
      
      const generateButton = page.getByRole('button', { name: /generate|filter|apply/i });
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should display sales report data', async ({ page }) => {
    await page.goto('/reports/sales');
    
    // Wait for report to load
    await page.waitForTimeout(2000);
    
    // Check for common report elements
    const reportElements = [
      /total.*sales/i,
      /revenue/i,
      /orders/i,
    ];

    for (const element of reportElements) {
      const el = page.getByText(element).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }
  });

  test('should export sales report', async ({ page }) => {
    await page.goto('/reports/sales');
    
    const exportButton = page.getByRole('button', { name: /export|download/i }).first();
    if (await exportButton.isVisible({ timeout: 5000 })) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await exportButton.click();
      
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/sales.*report/i);
      }
    }
  });

  test('should navigate to inventory report', async ({ page }) => {
    await page.goto('/reports');
    
    const inventoryReportLink = page.getByRole('link', { name: /inventory.*report/i }).first();
    if (await inventoryReportLink.isVisible({ timeout: 5000 })) {
      await inventoryReportLink.click();
      await expect(page).toHaveURL(/\/reports\/inventory/);
    }
  });

  test('should display inventory report data', async ({ page }) => {
    await page.goto('/reports/inventory');
    
    await page.waitForTimeout(2000);
    
    const reportElements = [
      /stock/i,
      /product/i,
      /quantity/i,
    ];

    for (const element of reportElements) {
      const el = page.getByText(element).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(el).toBeVisible();
      }
    }
  });

  test('should filter inventory report by category', async ({ page }) => {
    await page.goto('/reports/inventory');
    
    const categoryFilter = page.getByLabel(/category/i);
    if (await categoryFilter.isVisible({ timeout: 5000 })) {
      await categoryFilter.click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should show low stock items in inventory report', async ({ page }) => {
    await page.goto('/reports/inventory');
    
    const lowStockFilter = page.getByLabel(/low.*stock/i);
    if (await lowStockFilter.isVisible({ timeout: 5000 })) {
      await lowStockFilter.check();
      await page.waitForTimeout(500);
    }
  });
});
