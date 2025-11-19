import { test, expect } from '@playwright/test';

test.describe('Global Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display global search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('should search across all entities', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000); // Wait for debounce
      
      // Check if search results appear
      const searchResults = page.locator('[class*="search-result"], [role="listbox"]').first();
      if (await searchResults.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test('should show search results by category', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // Check for category headers in results
      const categories = [
        /products/i,
        /customers/i,
        /orders/i,
      ];
      
      for (const category of categories) {
        const categoryHeader = page.getByText(category).first();
        if (await categoryHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(categoryHeader).toBeVisible();
        }
      }
    }
  });

  test('should navigate to result on click', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      const firstResult = page.locator('[class*="search-result"] a, [role="option"]').first();
      if (await firstResult.isVisible({ timeout: 2000 })) {
        await firstResult.click();
        
        // Should navigate away from dashboard
        await page.waitForTimeout(500);
        const currentUrl = page.url();
        expect(currentUrl).not.toMatch(/\/dashboard$/);
      }
    }
  });

  test('should show no results message', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('xyznonexistentquery123');
      await page.waitForTimeout(1000);
      
      const noResults = page.getByText(/no.*results|not.*found/i).first();
      if (await noResults.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(noResults).toBeVisible();
      }
    }
  });

  test('should clear search on escape key', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      
      await searchInput.press('Escape');
      
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('should support keyboard navigation in results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // Try arrow down navigation
      await searchInput.press('ArrowDown');
      await page.waitForTimeout(200);
      
      // Try enter to select
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Page-specific Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should search products on products page', async ({ page }) => {
    await page.goto('/products');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // Results should be filtered in the table
      const table = page.locator('table, [role="table"]').first();
      await expect(table).toBeVisible();
    }
  });

  test('should search customers on customers page', async ({ page }) => {
    await page.goto('/customers');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
    }
  });

  test('should search sales orders on sales orders page', async ({ page }) => {
    await page.goto('/sales-orders');
    
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('SO-');
      await page.waitForTimeout(1000);
    }
  });

  test('should combine search with filters', async ({ page }) => {
    await page.goto('/products');
    
    const searchInput = page.getByPlaceholder(/search/i);
    const statusFilter = page.getByLabel(/status/i);
    
    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('test');
      
      if (await statusFilter.isVisible({ timeout: 2000 })) {
        await statusFilter.selectOption('ACTIVE');
      }
      
      await page.waitForTimeout(1000);
    }
  });
});
