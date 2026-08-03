import { Page } from '@playwright/test';

/**
 * Helper function to login to the application
 */
export async function login(page: Page, email = 'admin@mulaerp.com', password = 'admin123') {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Helper function to logout from the application
 */
export async function logout(page: Page) {
  const userMenu = page.locator('[aria-label*="user" i], button:has-text("admin")').first();
  if (await userMenu.isVisible({ timeout: 2000 })) {
    await userMenu.click();
    
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
      await page.waitForURL(/\/login/, { timeout: 5000 });
    }
  }
}

/**
 * Check if user is authenticated.
 *
 * Auth is an httpOnly cookie (MULAERP_AUTH) - not readable from page.evaluate() - so this asks
 * the server via GET /auth/me instead. page.request shares the browser context's cookie jar, so
 * a cookie set during page.goto()/form login flows through automatically.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/v1/auth/me');
  return response.ok();
}
