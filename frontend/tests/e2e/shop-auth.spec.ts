import { test, expect } from '@playwright/test';

/**
 * SHOP customer accounts - strictly separate identity from staff auth (MULAERP_SHOP cookie,
 * not MULAERP_AUTH). Reads directly from:
 *  - src/pages/shop/ShopRegisterPage.tsx / ShopLoginPage.tsx / ShopAccountPage.tsx
 *  - src/contexts/ShopAuthContext.tsx / src/lib/shop-api.ts
 *  - src/components/PublicLayout.tsx (header "Sign in" / "My account" link)
 *
 * Each test that registers a new account uses a timestamp-suffixed email so repeated runs
 * against the same database never collide with a prior run's 201 (see storefront.spec.ts's own
 * comment on this suite relying on persistent seed/demo data rather than resetting per test).
 */
test.describe('Shop customer accounts', () => {
  function uniqueEmail(prefix: string) {
    return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.test`;
  }

  test('guest storefront visitor sees "Sign in" and is never pushed to a login wall', async ({ page }) => {
    await page.goto('/');
    // The public catalogue must render fully for an anonymous visitor - no shop-account
    // requirement blocks browsing.
    await expect(page.getByRole('heading', { name: 'Shop', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My account' })).not.toBeVisible();
  });

  test('visiting /shop/account while signed out redirects to /shop/login, not the staff /login', async ({ page }) => {
    await page.goto('/shop/account');
    await expect(page).toHaveURL(/\/shop\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('register, then sign in, then see the account page with the header showing "My account"', async ({ page }) => {
    const email = uniqueEmail('shopper');
    const fullName = 'Playwright Shopper';
    const phone = '+60123456700';
    const password = 'password123';

    await page.goto('/shop/register');
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();

    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill(phone);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Register immediately follows up with a login (see ShopRegisterPage) - lands on the
    // account skeleton page signed in, no separate manual login step needed.
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'My account' })).toBeVisible();
    await expect(page.getByText(fullName)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();

    // Header now shows "My account", not "Sign in".
    await expect(page.getByRole('link', { name: 'My account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).not.toBeVisible();

    // Sign out clears the session; the account page's own guard then redirects to
    // /shop/login (not the staff /login), which also shows the "Sign in" header state.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/shop\/login$/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('registering with a duplicate email shows an inline error, not a redirect', async ({ page }) => {
    const email = uniqueEmail('dupe');
    const password = 'password123';

    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('First Attempt');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill('+60123456701');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/shop\/login$/, { timeout: 10000 });

    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Second Attempt');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill('+60123456702');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/shop\/register$/);
  });

  test('signing in with the wrong password shows an inline error', async ({ page }) => {
    const email = uniqueEmail('wrongpw');
    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Wrong Password Test');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill('+60123456703');
    await page.getByLabel('Password').fill('correctpassword');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });
    await page.getByRole('button', { name: 'Sign out' }).click();

    await page.goto('/shop/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/shop\/login$/);
  });

  test('a shop account session does not grant access to the staff app', async ({ page }) => {
    // Cross-boundary check from the browser side: after signing in as a shop customer, the
    // staff SPA must still treat the visitor as unauthenticated (ProtectedRoute -> /login),
    // and a direct API call to a staff endpoint using the browser's cookies must 401/403 - see
    // ShopCustomerAuthenticationFilter's javadoc for the backend enforcement this proves.
    const email = uniqueEmail('boundary');
    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Boundary Test');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill('+60123456704');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });

    const response = await page.request.get('/api/v1/products');
    expect([401, 403]).toContain(response.status());
  });
});
