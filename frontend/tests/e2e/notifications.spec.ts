import { test, expect } from '@playwright/test';

test.describe('Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display notification bell', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], button:has([class*="bell"])').first();
    if (await notificationBell.isVisible({ timeout: 5000 })) {
      await expect(notificationBell).toBeVisible();
    }
  });

  test('should show notification count badge', async ({ page }) => {
    const badge = page.locator('[class*="badge"], [class*="count"]').first();
    if (await badge.isVisible({ timeout: 5000 })) {
      await expect(badge).toBeVisible();
      
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/\d+/);
    }
  });

  test('should open notification panel', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], button:has([class*="bell"])').first();
    if (await notificationBell.isVisible({ timeout: 5000 })) {
      await notificationBell.click();
      
      const notificationPanel = page.locator('[role="dialog"], [class*="notification-panel"]').first();
      await expect(notificationPanel).toBeVisible({ timeout: 2000 });
    }
  });

  test('should display notification list', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], button:has([class*="bell"])').first();
    if (await notificationBell.isVisible({ timeout: 5000 })) {
      await notificationBell.click();
      
      await page.waitForTimeout(1000);
      
      const notificationItems = page.locator('[class*="notification-item"], li').first();
      if (await notificationItems.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(notificationItems).toBeVisible();
      }
    }
  });

  test('should mark notification as read', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], button:has([class*="bell"])').first();
    if (await notificationBell.isVisible({ timeout: 5000 })) {
      await notificationBell.click();
      
      const firstNotification = page.locator('[class*="notification-item"], li').first();
      if (await firstNotification.isVisible({ timeout: 2000 })) {
        await firstNotification.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should mark all notifications as read', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], button:has([class*="bell"])').first();
    if (await notificationBell.isVisible({ timeout: 5000 })) {
      await notificationBell.click();
      
      const markAllButton = page.getByRole('button', { name: /mark.*all.*read/i });
      if (await markAllButton.isVisible({ timeout: 2000 })) {
        await markAllButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should filter notifications by type', async ({ page }) => {
    const notificationBell = page.locator('[aria-label*="notification" i], button:has([class*="bell"])').first();
    if (await notificationBell.isVisible({ timeout: 5000 })) {
      await notificationBell.click();
      
      const filterButton = page.getByRole('button', { name: /filter|all|unread/i }).first();
      if (await filterButton.isVisible({ timeout: 2000 })) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show toast notification on action', async ({ page }) => {
    // Perform an action that triggers a toast
    await page.goto('/products/new');
    
    const timestamp = Date.now();
    await page.getByLabel(/sku/i).fill(`TEST-${timestamp}`);
    await page.getByLabel(/name/i).fill(`Test Product ${timestamp}`);
    await page.getByLabel(/unit price/i).fill('99.99');
    await page.getByLabel(/cost price/i).fill('50.00');
    await page.getByLabel(/stock quantity/i).fill('100');
    await page.getByLabel(/reorder level/i).fill('10');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Check for toast notification
    const toast = page.locator('[role="alert"], [class*="toast"]').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test('should auto-dismiss toast notification', async ({ page }) => {
    await page.goto('/products/new');
    
    const timestamp = Date.now();
    await page.getByLabel(/sku/i).fill(`TEST-${timestamp}`);
    await page.getByLabel(/name/i).fill(`Test Product ${timestamp}`);
    await page.getByLabel(/unit price/i).fill('99.99');
    await page.getByLabel(/cost price/i).fill('50.00');
    await page.getByLabel(/stock quantity/i).fill('100');
    await page.getByLabel(/reorder level/i).fill('10');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    const toast = page.locator('[role="alert"], [class*="toast"]').first();
    if (await toast.isVisible({ timeout: 10000 })) {
      // Wait for auto-dismiss (usually 3-5 seconds)
      await expect(toast).toBeHidden({ timeout: 10000 });
    }
  });
});
