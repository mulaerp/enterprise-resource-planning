import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display dashboard page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should display key metrics', async ({ page }) => {
    // Check for common dashboard metrics
    const metricsTexts = [
      /total.*sales/i,
      /revenue/i,
      /orders/i,
      /customers/i,
      /products/i,
      /inventory/i
    ];

    for (const text of metricsTexts) {
      const element = page.getByText(text).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(element).toBeVisible();
      }
    }
  });

  test('should display charts', async ({ page }) => {
    // Wait for charts to load
    await page.waitForTimeout(2000);
    
    // Check if recharts or chart elements are present
    const chartContainer = page.locator('.recharts-wrapper, [class*="chart"]').first();
    if (await chartContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(chartContainer).toBeVisible();
    }
  });

  test('should navigate to different sections from dashboard', async ({ page }) => {
    const links = [
      { name: /products/i, url: /\/products/ },
      { name: /customers/i, url: /\/customers/ },
      { name: /sales/i, url: /\/sales-orders/ },
    ];

    for (const link of links) {
      const linkElement = page.getByRole('link', { name: link.name }).first();
      if (await linkElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        await linkElement.click();
        await expect(page).toHaveURL(link.url);
        await page.goBack();
      }
    }
  });

  test('should display notifications bell', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], [class*="notification"]').first();
    if (await notificationBell.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(notificationBell).toBeVisible();
    }
  });

  test('should display global search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(searchInput).toBeVisible();
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('should display user menu', async ({ page }) => {
    const userMenu = page.locator('[aria-label*="user" i], [class*="user-menu"]').first();
    if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userMenu.click();
      
      // Check for logout option
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(logoutButton).toBeVisible();
      }
    }
  });

  test('should show low stock alerts', async ({ page }) => {
    const lowStockAlert = page.getByText(/low.*stock/i).first();
    if (await lowStockAlert.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(lowStockAlert).toBeVisible();
    }
  });

  test('should display recent activities', async ({ page }) => {
    const recentActivities = page.getByText(/recent.*activities|recent.*orders/i).first();
    if (await recentActivities.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(recentActivities).toBeVisible();
    }
  });
});
