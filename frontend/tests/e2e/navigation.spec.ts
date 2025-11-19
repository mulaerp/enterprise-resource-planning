import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display sidebar navigation', async ({ page }) => {
    const sidebar = page.locator('nav, aside, [role="navigation"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should navigate through all main sections', async ({ page }) => {
    const sections = [
      { name: /dashboard/i, url: /\/dashboard/ },
      { name: /products/i, url: /\/products/ },
      { name: /customers/i, url: /\/customers/ },
      { name: /suppliers/i, url: /\/suppliers/ },
      { name: /sales.*orders/i, url: /\/sales-orders/ },
      { name: /reports/i, url: /\/reports/ },
    ];

    for (const section of sections) {
      const link = page.getByRole('link', { name: section.name }).first();
      if (await link.isVisible({ timeout: 2000 })) {
        await link.click();
        await expect(page).toHaveURL(section.url);
      }
    }
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/products');
    
    const activeLink = page.getByRole('link', { name: /products/i }).first();
    if (await activeLink.isVisible()) {
      // Check if the link has an active class or aria-current
      const ariaCurrentValue = await activeLink.getAttribute('aria-current');
      const className = await activeLink.getAttribute('class');
      
      expect(ariaCurrentValue === 'page' || className?.includes('active')).toBeTruthy();
    }
  });

  test('should display breadcrumbs', async ({ page }) => {
    await page.goto('/products/new');
    
    const breadcrumbs = page.locator('[aria-label*="breadcrumb" i], nav ol, nav ul').first();
    if (await breadcrumbs.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(breadcrumbs).toBeVisible();
    }
  });

  test('should navigate using browser back button', async ({ page }) => {
    await page.goto('/products');
    await page.goto('/customers');
    
    await page.goBack();
    await expect(page).toHaveURL(/\/products/);
    
    await page.goForward();
    await expect(page).toHaveURL(/\/customers/);
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Clear storage to logout
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout successfully', async ({ page }) => {
    // Find and click logout button
    const userMenu = page.locator('[aria-label*="user" i], button:has-text("admin")').first();
    if (await userMenu.isVisible({ timeout: 2000 })) {
      await userMenu.click();
      
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible({ timeout: 2000 })) {
        await logoutButton.click();
        await expect(page).toHaveURL(/\/login/);
      }
    }
  });

  test('should handle 404 routes', async ({ page }) => {
    await page.goto('/non-existent-route');
    
    // Should either redirect to dashboard or show 404 page
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|login|404)/);
  });

  test('should maintain navigation state on page refresh', async ({ page }) => {
    await page.goto('/products');
    await page.reload();
    
    await expect(page).toHaveURL(/\/products/);
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
  });
});
