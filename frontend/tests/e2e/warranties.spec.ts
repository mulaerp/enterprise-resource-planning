import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { fieldByLabel, formatMoney, valueAfterLabel, modalByTitle } from '../helpers/pos';

/**
 * Warranties - auto-issued when a product with `warrantyMonths` sells at PoS,
 * filing a claim (which creates a linked, no-charge repair job), and the
 * public warranty-checker surfacing the same warranty by number. Reads
 * directly from:
 *  - src/pages/products/ProductFormPage.tsx (the "Warranty (months)" field -
 *    /pos/intake has no warranty field, so the product is created here instead)
 *  - src/pages/pos/RegisterPage.tsx (selling the product to trigger auto-issue)
 *  - src/pages/warranty/WarrantyListPage.tsx / WarrantyDetailPage.tsx
 *  - src/pages/repair/RepairDetailPage.tsx (the warranty-claim banner + locked total)
 *  - src/pages/public/WarrantyCheckPage.tsx
 *
 * modalByTitle/valueAfterLabel/fieldByLabel come from tests/helpers/pos.ts -
 * they already handle the shared Input/Textarea components' label wiring and
 * the register's "Total"/"Sale number" sibling-value pattern.
 */
test.describe.serial('Warranties', () => {
  let page: Page;
  let productName: string;
  let productSku: string;
  let warrantyId: string;
  let warrantyNumber: string;
  let repairId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('creates a product with a warranty via the Products form', async () => {
    const stamp = Date.now();
    productName = `Warranty Test Widget ${stamp}`;
    productSku = `WARR-${stamp}`;

    await page.goto('/products/new');
    await expect(page.getByRole('heading', { name: 'Add New Product' })).toBeVisible();

    await page.locator('#product-sku').fill(productSku);
    await page.locator('#product-name').fill(productName);
    await page.locator('#product-unit-price').fill('80');
    await page.locator('#product-cost-price').fill('40');
    await page.locator('#product-stock-quantity').fill('5');
    await page.locator('#product-warranty-months').fill('12');

    await page.getByRole('button', { name: 'Create Product' }).click();
    await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/products$/);
  });

  test('sells the product at the PoS register, auto-issuing the warranty', async () => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Point of Sale', level: 1 })).toBeVisible();

    const search = page.getByLabel('Search products');
    await search.fill(productName);
    await expect(page.getByText(productSku)).toBeVisible({ timeout: 10000 });
    await search.press('Enter');

    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(80));
    await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(80));

    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill('80.00');
    await page.getByRole('button', { name: 'Complete Sale' }).click();

    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(80));
  });

  test('the warranty list shows it ACTIVE, searchable by product name', async () => {
    await page.goto('/warranties');
    await expect(page.getByRole('heading', { name: 'Warranties', level: 1 })).toBeVisible();

    await page.getByLabel('Search warranties').fill(productName);
    const row = page.locator('table tbody tr', { hasText: productName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('ACTIVE');

    await row.click();
    await expect(page).toHaveURL(/\/warranties\/[^/]+$/, { timeout: 10000 });
    warrantyId = page.url().split('/').pop()!;

    // level-1 heading is scoped by name - the staff Layout sidebar also renders
    // its own (unrelated) <h1>{branding.appName}</h1>.
    const heading = page.getByRole('heading', { level: 1, name: 'Warranty' });
    await expect(heading).toContainText('Warranty WTY-');
    warrantyNumber = ((await heading.textContent()) ?? '').replace('Warranty ', '').trim();
    expect(warrantyNumber).toMatch(/^WTY-\d{4}-\d{6}-[0-9a-f]{4}$/);
    // V44: the raw "12 month(s)" text was replaced by WarrantyDto#coverageLabel, e.g.
    // "12 months (product)" - see WarrantyDetailPage.tsx's Coverage row.
    await expect(page.getByText('12 months (product)')).toBeVisible();
  });

  test('filing a claim creates a linked, no-charge repair job', async () => {
    await page.goto(`/warranties/${warrantyId}`);

    await fieldByLabel(page, 'Reported fault').fill('Widget stopped powering on after two weeks of normal use');
    await page.getByRole('button', { name: 'File Claim' }).click();

    await expect(page).toHaveURL(/\/repairs\/[^/]+$/, { timeout: 10000 });
    repairId = page.url().split('/').pop()!;
    expect(repairId).toBeTruthy();

    await expect(page.getByText('This is a warranty claim - no charge applies.')).toBeVisible();
    const viewWarrantyLink = page.getByRole('link', { name: 'View warranty' });
    await expect(viewWarrantyLink).toBeVisible();
    await expect(viewWarrantyLink).toHaveAttribute('href', `/warranties/${warrantyId}`);

    await expect(page.locator(':text-is("Total") + *')).toHaveText(formatMoney(0));
  });

  test('the warranty now shows CLAIMED', async () => {
    await page.goto(`/warranties/${warrantyId}`);
    await expect(page.getByText('CLAIMED', { exact: true })).toBeVisible();
    await expect(
      page.getByText('This warranty is claimed and can no longer be claimed.')
    ).toBeVisible();
  });

  test('the public warranty checker finds it by warranty number', async () => {
    await page.goto('/shop/warranty');
    await page.getByLabel(/warranty or serial number/i).fill(warrantyNumber);
    await page.getByRole('button', { name: 'Check' }).click();

    await expect(page.getByText('Warranty found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(productName)).toBeVisible();
  });
});

/**
 * WEBSHOP GAP B (now fixed) - the identical warranty auto-issue that a PoS sale triggers above
 * also fires for an ONLINE order's fulfilment (`ShopOrderService#fulfilOrder` calling
 * `WarrantyService#autoIssueForShopOrderLine`, reusing this exact service rather than duplicating
 * warranty logic), one per unit. API-level (page.request) since the full UI checkout flow is
 * already covered by the shop-guest-buyer/shop-member-buyer persona specs - this file's job is
 * proving the warranty-issuance contract itself, the same way the PoS describe block above does
 * for its own channel.
 *
 * WARRANTY-TIERS (V44): a product with NO warrantyMonths used to issue nothing at all - it now
 * always issues the guest/member channel-base-days floor (see WarrantyService#resolveDuration),
 * a deliberate behaviour change covered below and exercised more fully in warranty-tiers.spec.ts.
 */
test.describe.serial('Warranty issued from an online (webshop) purchase', () => {
  let page: Page;
  let stamp: number;
  let warrantyProductId: string;
  let noWarrantyProductId: string;
  let warrantyProductName: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
    stamp = Date.now();
    warrantyProductName = `Webshop Warranty Widget ${stamp}`;

    const withWarranty = await page.request.post('/api/v1/products', {
      data: {
        sku: `WWARR-${stamp}`, name: warrantyProductName, unitPrice: 130, costPrice: 55,
        acquisitionCost: 55, stockQuantity: 2, reorderLevel: 0, status: 'ACTIVE',
        warrantyMonths: 9,
      },
    });
    expect(withWarranty.ok()).toBeTruthy();
    warrantyProductId = (await withWarranty.json()).id;

    const withoutWarranty = await page.request.post('/api/v1/products', {
      data: {
        sku: `WNOWARR-${stamp}`, name: `Webshop No-Warranty Widget ${stamp}`, unitPrice: 70,
        costPrice: 25, acquisitionCost: 25, stockQuantity: 1, reorderLevel: 0, status: 'ACTIVE',
      },
    });
    expect(withoutWarranty.ok()).toBeTruthy();
    noWarrantyProductId = (await withoutWarranty.json()).id;
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('fulfilling an online order for a warrantyMonths product issues one warranty per unit, listed in the staff Warranties page', async () => {
    // `page` carries a staff (MULAERP_AUTH) session, not a shop-customer one, so it places as a
    // GUEST via the public endpoint - staff fulfilment works identically regardless of who placed
    // the order (see ShopOrderService#fulfilOrder, which never branches on that).
    const guestPlaced = await page.request.post('/api/v1/public/shop/orders', {
      data: {
        items: [{ productId: warrantyProductId, quantity: 2 }],
        fulfilmentType: 'COLLECT',
        guestEmail: `warranty-webshop-${stamp}@example.test`,
        guestName: 'Warranty Webshop Guest',
        guestPhone: '+60111000333',
      },
    });
    expect(guestPlaced.ok(), await guestPlaced.text()).toBeTruthy();
    const orderId = (await guestPlaced.json()).id;

    const fulfilled = await page.request.post(`/api/v1/shop/admin/orders/${orderId}/fulfil`, { data: {} });
    expect(fulfilled.ok(), await fulfilled.text()).toBeTruthy();
    const body = await fulfilled.json();
    expect(body.status).toBe('FULFILLED');
    expect(body.warrantyNumbers).toHaveLength(2); // one per unit, quantity 2

    await page.goto('/warranties');
    await page.getByLabel('Search warranties').fill(warrantyProductName);
    const rows = page.locator('table tbody tr', { hasText: warrantyProductName });
    await expect(rows).toHaveCount(2, { timeout: 10000 });
    await expect(rows.first()).toContainText('ACTIVE');
  });

  test('WARRANTY-TIERS: fulfilling an online GUEST order for a product with NO warrantyMonths now issues the guest-base warranty, not nothing', async () => {
    const guestPlaced = await page.request.post('/api/v1/public/shop/orders', {
      data: {
        items: [{ productId: noWarrantyProductId, quantity: 1 }],
        fulfilmentType: 'COLLECT',
        guestEmail: `no-warranty-webshop-${stamp}@example.test`,
        guestName: 'No Warranty Webshop Guest',
        guestPhone: '+60111000444',
      },
    });
    expect(guestPlaced.ok(), await guestPlaced.text()).toBeTruthy();
    const orderId = (await guestPlaced.json()).id;

    const fulfilled = await page.request.post(`/api/v1/shop/admin/orders/${orderId}/fulfil`, { data: {} });
    expect(fulfilled.ok(), await fulfilled.text()).toBeTruthy();
    const body = await fulfilled.json();
    // Deliberate behaviour change (V44): a product with no warrantyMonths at all used to yield no
    // warranty on fulfilment. It now always yields the channel-base-days floor - this order has no
    // shopCustomerId/memberId (a guest), so it gets the GUEST_BASE figure.
    expect(body.warrantyNumbers).toHaveLength(1);

    const lookup = await page.request.get(`/api/v1/public/warranty/${body.warrantyNumbers[0]}`);
    expect(lookup.ok()).toBeTruthy();
    const looked = await lookup.json();
    expect(looked.found).toBe(true);
    expect(looked.coverageLabel).toContain('(guest)');
  });
});
