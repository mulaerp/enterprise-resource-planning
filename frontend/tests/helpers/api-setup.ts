import type { Page } from '@playwright/test';

/**
 * API-driven precondition helpers, complementing ui-actions.ts's UI-driven equivalents. Useful
 * where a persona scenario needs data to exist (a product, a sale, a member's current balance)
 * but the point of the test is a *different* screen - going through the full UI flow just to get
 * there would be slow and would duplicate assertions already covered elsewhere (e.g. pos.spec.ts
 * already exercises the register's checkout UI in detail).
 *
 * All of these run against `page.request`, which shares the browser context's cookie jar - so
 * `apiLogin` followed by `page.goto(...)` in the same test is already authenticated, and a test
 * that needs to go back to being anonymous afterwards should call
 * `page.context().clearCookies()`.
 */

/**
 * Logs in via the JSON auth API directly (no UI navigation/typing) - sets the MULAERP_AUTH cookie
 * on this page's browser context so subsequent page.goto()/page.request calls are authenticated.
 * Prefer helpers/auth.ts's UI-driven `login()` for tests actually exercising the login form or
 * relying on the request being slow enough to observe loading states; use this one purely to get
 * an authenticated session for API setup calls.
 */
export async function apiLogin(page: Page, email: string, password: string): Promise<void> {
  const response = await page.request.post('/api/v1/auth/login', { data: { email, password } });
  if (!response.ok()) {
    throw new Error(`apiLogin failed for ${email}: ${response.status()} ${await response.text()}`);
  }
}

export interface CreatedApiProduct {
  id: string;
  sku: string;
  name: string;
}

/**
 * Creates a product directly via POST /api/v1/products - the same endpoint both the thrift-intake
 * form (IntakePage) and the product form (ProductFormPage) call, without driving either UI.
 * Caller must already be authenticated (see apiLogin) as a role RoleRules.PRODUCT_CREATE permits
 * (CASHIER/INVENTORY/MANAGER/ADMIN).
 */
export async function createProductViaApi(
  page: Page,
  overrides: Record<string, unknown> = {}
): Promise<CreatedApiProduct> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const payload = {
    sku: `API-${stamp}`,
    name: `API Product ${stamp}`,
    unitPrice: 100,
    costPrice: 40,
    stockQuantity: 5,
    reorderLevel: 0,
    status: 'ACTIVE',
    ...overrides,
  };
  const response = await page.request.post('/api/v1/products', { data: payload });
  if (!response.ok()) {
    throw new Error(`createProductViaApi failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Creates a PoS sale directly via POST /api/v1/pos/sales - same request contract as
 * lib/pos-offline.ts's `submitSale`, for tests that need a completed sale to exist (e.g. to
 * trigger the warranty auto-issue hook for a buyer-persona check) without driving the whole
 * register UI, which pos.spec.ts already covers in detail.
 */
export async function createSaleViaApi(page: Page, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await page.request.post('/api/v1/pos/sales', {
    data: { clientSaleId: `api-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...payload },
  });
  if (!response.ok()) {
    throw new Error(`createSaleViaApi failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

/**
 * GET helper for any authenticated JSON endpoint - returns the parsed body, throwing on a non-2xx
 * so a broken precondition fails loudly at the setup step instead of the test asserting against
 * `undefined` several lines later.
 */
export async function apiGet(page: Page, url: string): Promise<Record<string, unknown>> {
  const response = await page.request.get(url);
  if (!response.ok()) {
    throw new Error(`GET ${url} failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}
