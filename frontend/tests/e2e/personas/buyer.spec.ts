import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { formatMoney } from '../../helpers/pos';

/**
 * Persona 2 - Buyer (anonymous customer, no login).
 *
 * Every test in this file uses the plain `page` fixture, which never receives an auth cookie -
 * all precondition setup below goes through a separate, manually-created `APIRequestContext`
 * instead (its own, independent cookie jar, logged in once for the whole file - see the
 * `cashierApi` setup below), so the storefront/warranty/repair-lookup checks genuinely exercise
 * the anonymous, `permitAll` surface rather than an authenticated session that merely renders
 * public pages fine anyway.
 *
 * Reads directly from:
 *  - src/pages/public/{StorefrontPage,StorefrontItemPage,WarrantyCheckPage}.tsx
 *  - src/components/PublicLayout.tsx (public nav - Shop/Warranty Check/Staff login, no staff sidebar)
 *  - backend PublicCatalogController/PublicWarrantyController/PublicRepairController (all
 *    `permitAll`, always-200 "not found" contracts rather than 404s)
 *
 * The public repair-status lookup (GET /api/v1/public/repairs/{jobNumber}) has no dedicated
 * frontend page yet (only /shop/warranty exists as a UI under /shop/*) - exercised directly
 * against the API via `page.request`, which is still a same-origin, unauthenticated call from the
 * buyer's own (cookie-less) browser context.
 */
test.describe.serial('Persona: Buyer (anonymous)', () => {
  const stamp = Date.now();
  const itemName = `Buyer Storefront Item ${stamp}`;
  const itemSku = `BUY-${stamp}`;
  const sellPrice = 300;
  const buyPrice = 150;
  let jobNumber: string;
  let warrantyNumber: string;
  let cashierApi: APIRequestContext;

  // A single, manually-created APIRequestContext (not the built-in `request` fixture, which is
  // test-scoped and would need a fresh login every test) shared read/write across this whole
  // file's setup calls - one login for the whole file instead of one per test, so this anonymous-
  // persona spec doesn't spend more of the shared login rate-limit budget
  // (RateLimitConfig - 300/15min per IP) than it has to. `page` itself never touches this context,
  // so every test's browser session stays genuinely anonymous.
  test.beforeAll(async () => {
    cashierApi = await pwRequest.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    });
    const login = await cashierApi.post('/api/v1/auth/login', {
      data: { email: 'cashier@mulaerp.com', password: 'admin123' },
    });
    expect(login.ok(), `cashier login failed: ${login.status()}`).toBeTruthy();
  });

  test.afterAll(async () => {
    await cashierApi.dispose();
  });

  test('finds a freshly intaken item by search and its detail page shows WE SELL/WE BUY prices and a stock badge', async ({
    page,
  }) => {
    // Precondition setup as CASHIER, entirely on `cashierApi` (a separate cookie jar from `page`,
    // which never receives an auth cookie anywhere in this file) - mirrors "the seller intakes an
    // item, sells one with a warranty, and books a walk-in repair", without re-testing the
    // register/repair UI that seller.spec.ts / repair-journey.spec.ts already cover in detail.
    const productRes = await cashierApi.post('/api/v1/products', {
      data: {
        sku: itemSku,
        name: itemName,
        unitPrice: sellPrice,
        costPrice: 120,
        acquisitionCost: 120,
        stockQuantity: 1,
        reorderLevel: 0,
        status: 'ACTIVE',
        condition: 'GOOD',
        buyPrice,
        warrantyMonths: 12,
      },
    });
    expect(productRes.ok(), `product create failed: ${productRes.status()}`).toBeTruthy();

    const repairRes = await cashierApi.post('/api/v1/repairs', {
      data: {
        walkInName: `Buyer Repair Customer ${stamp}`,
        walkInPhone: `019${`${stamp}`.slice(-8)}`,
        deviceDescription: 'Nintendo Switch, joy-con drift',
        reportedFault: 'Left joy-con stick drifts without input',
      },
    });
    expect(repairRes.ok(), `repair create failed: ${repairRes.status()}`).toBeTruthy();
    const repair = await repairRes.json();
    jobNumber = repair.jobNumber;
    expect(jobNumber).toBeTruthy();

    await page.goto('/');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);

    const card = page.locator('a[href^="/shop/item/"]', { hasText: itemName });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.getByText(`WE SELL ${formatMoney(sellPrice)}`)).toBeVisible();
    await expect(card.getByText(/^In Stock$/)).toBeVisible();

    await card.click();
    await expect(page).toHaveURL(new RegExp(`/shop/item/${itemSku}$`));
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`WE SELL ${formatMoney(sellPrice)}`)).toBeVisible();
    await expect(page.getByText(`WE BUY ${formatMoney(buyPrice)}`)).toBeVisible();
  });

  test('after the seller sells the last unit, the stock badge reflects it', async ({ page }) => {
    // `page` in this test still never sees a cookie - all setup is on the shared `cashierApi`.
    const productRes = await cashierApi.get(`/api/v1/products?search=${encodeURIComponent(itemSku)}`);
    expect(productRes.ok()).toBeTruthy();
    const { content } = await productRes.json();
    const product = content.find((p: { sku: string }) => p.sku === itemSku);
    expect(product, 'precondition product should still be findable by SKU').toBeTruthy();

    const saleRes = await cashierApi.post('/api/v1/pos/sales', {
      data: {
        clientSaleId: `buyer-spec-sale-${stamp}`,
        paymentMethod: 'CASH',
        amountTendered: sellPrice,
        lines: [{ productId: product.id, quantity: 1, unitPrice: sellPrice }],
      },
    });
    expect(saleRes.ok(), `sale create failed: ${saleRes.status()}`).toBeTruthy();

    // The catalogue auto-refreshes every 30s (StorefrontPage.tsx), but a fresh navigation
    // re-fetches immediately - no need to wait out the interval.
    await page.goto(`/shop/item/${itemSku}`);
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Out of Stock')).toBeVisible({ timeout: 10000 });

    await page.goto('/');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    const card = page.locator('a[href^="/shop/item/"]', { hasText: itemName });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.getByText('Out of Stock')).toBeVisible();
  });

  test('checks a warranty by number (found) and a bogus one (not found)', async ({ page }) => {
    // The sale in the previous test auto-issued a warranty for this warrantyMonths-bearing
    // product (PosSaleService#issueLineWarranties) - find it by product name.
    const warrantyRes = await cashierApi.get(`/api/v1/warranties?search=${encodeURIComponent(itemName)}`);
    expect(warrantyRes.ok()).toBeTruthy();
    const { content } = await warrantyRes.json();
    expect(content.length, 'a warranty should have been auto-issued for the prior sale').toBeGreaterThan(0);
    warrantyNumber = content[0].warrantyNumber;
    expect(warrantyNumber).toBeTruthy();

    await page.goto('/shop/warranty');
    await page.getByLabel(/warranty or serial number/i).fill(warrantyNumber);
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Warranty found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(itemName)).toBeVisible();
    await expect(page.getByText('ACTIVE')).toBeVisible();

    await page.goto('/shop/warranty');
    await page.getByLabel(/warranty or serial number/i).fill('NOT-A-REAL-WARRANTY-CODE');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('No warranty found for that number.')).toBeVisible({ timeout: 10000 });
  });

  test("checks a repair job's public status by job number", async ({ page }) => {
    const response = await page.request.get(`/api/v1/public/repairs/${jobNumber}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.found).toBe(true);
    expect(body.jobNumber).toBe(jobNumber);
    expect(body.status).toBe('RECEIVED');

    const bogus = await page.request.get('/api/v1/public/repairs/RJ-0000-NOTREAL-0000');
    expect(bogus.ok()).toBeTruthy();
    const bogusBody = await bogus.json();
    expect(bogusBody.found).toBe(false);
  });

  test('no staff nav/sidebar is present on public pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Point of Sale' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Oversight' })).toHaveCount(0);

    await page.goto('/shop/warranty');
    await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

    await page.goto(`/shop/item/${itemSku}`);
    await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
  });
});
