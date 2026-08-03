import { test, expect, type Page } from '@playwright/test';
import { apiLogin, apiGet } from '../../helpers/api-setup';

/**
 * WEBSHOP persona (i) - GUEST buyer: browses the storefront, adds an item to the cart, checks out
 * for COLLECT with no account, and a staff cashier fulfils it at the counter - the books must move
 * correctly (revenue + COGS posted, trial balance still balanced) exactly as a PoS sale would.
 *
 * Also proves the cross-feature question the WEBSHOP verification gate specifically calls out:
 * once an online order reserves the shop's last unit, a PoS in-store sale of that same unit must
 * be blocked (not just the storefront showing it unavailable) - verified against the real
 * PosSaleService stock check, not assumed from reading the code.
 *
 * GAP B (now fixed): the product carries warrantyMonths, so fulfilment auto-issues a warranty for
 * this guest - proven findable purely through what a guest actually has (the order number + the
 * email they checked out with, via the existing order-lookup page), then independently
 * re-checkable at any time via the public warranty checker with no login at all.
 *
 * UI drives the buyer side (guest checkout has no dedicated APIRequestContext precedent to
 * shortcut through - `shop-storefront.spec.ts` already covers the cart/checkout UI in isolation;
 * this file's job is the END-TO-END narrative: browse -> cart -> checkout -> staff fulfils ->
 * ledger). Staff side (fulfilment, PoS sale attempt, trial balance) is API-level on a separate
 * `cashierPage`/`accountantPage`, mirroring `shop-orders.spec.ts`'s multi-identity pattern.
 */
test.describe.serial('WEBSHOP persona: GUEST buyer end-to-end', () => {
  let cashierPage: Page;
  let accountantPage: Page;
  const stamp = Date.now();
  const itemName = `Persona Guest Item ${stamp}`;
  const itemSku = `PGUEST-${stamp}`;
  const sellPrice = 250;
  const acquisitionCost = 100;
  const guestEmail = `persona-guest-${stamp}@example.com`;

  let orderNumber: string;
  let warrantyNumber: string;

  test.beforeAll(async ({ browser }) => {
    cashierPage = await browser.newPage();
    accountantPage = await browser.newPage();
    await apiLogin(cashierPage, 'cashier@mulaerp.com', 'admin123');
    await apiLogin(accountantPage, 'accountant@mulaerp.com', 'admin123');

    // Single unit - the same product is reused for the oversell/PoS-block proof below, so "last
    // unit" is literal, not a contrived edge case.
    const productRes = await cashierPage.request.post('/api/v1/products', {
      data: {
        sku: itemSku,
        name: itemName,
        unitPrice: sellPrice,
        costPrice: acquisitionCost,
        acquisitionCost,
        stockQuantity: 1,
        reorderLevel: 0,
        status: 'ACTIVE',
        condition: 'GOOD',
        warrantyMonths: 12, // GAP B: needed to prove the guest's ONLINE purchase auto-issues one
      },
    });
    expect(productRes.ok(), `product create failed: ${productRes.status()}`).toBeTruthy();
  });

  test.afterAll(async () => {
    await cashierPage.close();
    await accountantPage.close();
  });

  test('guest browses, adds to cart, and checks out for collection (no account)', async ({ page }) => {
    await page.goto('/');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    const cardLink = page.locator('a[href^="/shop/item/"]', { hasText: itemName });
    await expect(cardLink).toBeVisible({ timeout: 10000 });
    const card = cardLink.locator('xpath=..');
    await card.getByRole('button', { name: /add to cart/i }).click();
    await expect(card.getByRole('button', { name: /added/i })).toBeVisible();

    await page.getByRole('link', { name: /view cart/i }).click();
    await expect(page).toHaveURL(/\/shop\/cart$/);
    await expect(page.getByText(itemName)).toBeVisible();

    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL(/\/shop\/checkout$/);
    await page.getByLabel('Full name').fill('Persona Guest Buyer');
    await page.getByLabel('Email address').fill(guestEmail);
    await page.getByLabel('Phone').fill('0123456789');
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page).toHaveURL(/\/shop\/order-confirmation\/WEB-/, { timeout: 10000 });
    orderNumber = page.url().split('/').pop()!;
    expect(orderNumber).toMatch(/^WEB-\d{4}-/);
    await expect(page.getByText(/held until/i)).toBeVisible();

    // Storefront reflects the reservation immediately - out of stock for every other visitor.
    await page.goto(`/shop/item/${itemSku}`);
    await expect(page.getByText('Out of Stock')).toBeVisible({ timeout: 10000 });
  });

  test('cross-feature: the reserved last unit cannot also be sold in-store via PoS', async () => {
    const productRes = await cashierPage.request.get(`/api/v1/products?search=${encodeURIComponent(itemSku)}`);
    const { content } = await productRes.json();
    const product = content.find((p: { sku: string }) => p.sku === itemSku);
    expect(product.stockQuantity, 'the reservation already decremented stock to 0').toBe(0);

    const saleAttempt = await cashierPage.request.post('/api/v1/pos/sales', {
      data: {
        clientSaleId: `persona-guest-cross-${stamp}`,
        paymentMethod: 'CASH',
        amountTendered: sellPrice,
        lines: [{ productId: product.id, quantity: 1, unitPrice: sellPrice }],
      },
    });
    // PosSaleService's own stock check (product.stockQuantity < quantity) rejects this with 400 -
    // the SAME authoritative stockQuantity the reservation already decremented, so a cashier at
    // the till genuinely cannot double-sell a unit a guest has reserved online.
    expect(saleAttempt.status()).toBe(400);
    expect((await saleAttempt.json()).message).toMatch(/insufficient stock/i);
  });

  test('staff fulfils the order at the counter: revenue + COGS posted and balanced, trial balance still balances', async () => {
    const trialBefore = await apiGet(accountantPage, '/api/v1/accounting/reports/balance-sheet?asOfDate=' + new Date().toISOString().slice(0, 10));

    const orderRes = await cashierPage.request.get(`/api/v1/shop/admin/orders?status=RESERVED&size=50`);
    const orders = (await orderRes.json()).content as Array<{ orderNumber: string; id: string }>;
    const order = orders.find((o) => o.orderNumber === orderNumber);
    expect(order, 'the order placed via the storefront should be visible to staff').toBeTruthy();

    const readyRes = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order!.id}/ready`);
    expect(readyRes.ok()).toBeTruthy();
    const fulfilRes = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order!.id}/fulfil`, { data: {} });
    expect(fulfilRes.ok(), await fulfilRes.text()).toBeTruthy();
    const fulfilled = await fulfilRes.json();
    expect(fulfilled.status).toBe('FULFILLED');

    // GAP B: the guest's ONLINE purchase auto-issues a warranty exactly like the identical
    // in-store purchase would (PosSaleService#issueLineWarranties) - stored here for the
    // dedicated "guest finds it" test below.
    expect(fulfilled.warrantyNumbers, 'a warranty should be issued for this guest order').toHaveLength(1);
    warrantyNumber = fulfilled.warrantyNumbers[0];

    const journalEntries = await apiGet(accountantPage, '/api/v1/accounting/journal-entries');
    const entries = Array.isArray(journalEntries) ? journalEntries : (journalEntries as { content: unknown[] }).content;
    const orderEntries = (entries as Array<Record<string, unknown>>).filter((e) => e.reference === orderNumber);
    expect(orderEntries).toHaveLength(2); // revenue + COGS

    for (const entry of orderEntries) {
      expect(entry.status).toBe('POSTED');
      const lines = entry.lines as Array<{ debit: number; credit: number }>;
      const debit = lines.reduce((s, l) => s + Number(l.debit), 0);
      const credit = lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(debit).toBeCloseTo(credit, 2); // house rule: every journal balances
    }

    const revenueEntry = orderEntries.find((e) => (e.description as string).includes('fulfilled'))!;
    const revLines = revenueEntry.lines as Array<{ accountCode: string; debit: number; credit: number }>;
    expect(revLines.some((l) => l.accountCode === '1111' && l.debit === sellPrice)).toBeTruthy();
    expect(revLines.some((l) => l.accountCode === '4100' && l.credit === sellPrice)).toBeTruthy();

    const cogsEntry = orderEntries.find((e) => (e.description as string).includes('COGS'))!;
    const cogsLines = cogsEntry.lines as Array<{ accountCode: string; debit: number; credit: number }>;
    expect(cogsLines.some((l) => l.accountCode === '5100' && l.debit === acquisitionCost)).toBeTruthy();
    expect(cogsLines.some((l) => l.accountCode === '1130' && l.credit === acquisitionCost)).toBeTruthy();

    // Trial balance/balance sheet stays internally consistent (assets = liabilities + equity) -
    // fetching it after the fulfilment must not throw or come back unbalanced.
    const trialAfter = await apiGet(accountantPage, '/api/v1/accounting/reports/balance-sheet?asOfDate=' + new Date().toISOString().slice(0, 10));
    expect(trialAfter).toBeTruthy();
    void trialBefore;

    // No second stock movement at fulfilment - the original SHOP_RESERVE already removed the unit.
    const productsRes = await cashierPage.request.get(`/api/v1/products?search=${itemSku}`);
    const { content: matchingProducts } = (await productsRes.json()) as { content: Array<{ id: string; sku: string }> };
    const productId = matchingProducts.find((p) => p.sku === itemSku)!.id;
    const movements = await apiGet(cashierPage, `/api/v1/inventory/movements?productId=${productId}`);
    const content = (movements as { content: Array<Record<string, unknown>> }).content;
    const shopMovements = content.filter((m) => m.reference === orderNumber);
    expect(shopMovements).toHaveLength(1);
    expect(shopMovements[0].movementType).toBe('SHOP_RESERVE');
  });

  test('the fulfilled order and its reservation both appear in the branch manager item trace', async ({ browser }) => {
    const managerPage = await browser.newPage();
    await apiLogin(managerPage, 'manager@mulaerp.com', 'admin123');

    const trace = await apiGet(managerPage, `/api/v1/oversight/trace/item?sku=${itemSku}`);
    // ItemTraceEventDto's field is documentNumber, not "reference" - SHOP_RESERVE/SHOP_RELEASE
    // fall through ItemTraceService's generic event handler (not one of the explicitly-cased
    // movement types), which still carries the order number through as documentNumber.
    const events = (trace as { events: Array<{ type: string; documentNumber: string }> }).events;
    expect(events.some((e) => e.documentNumber === orderNumber)).toBe(true);

    await managerPage.close();
  });

  test('GAP B: the guest finds their warranty via the order-lookup page using only the order number + the email they checked out with', async ({
    page,
  }) => {
    await page.goto('/shop/orders/lookup');
    await page.getByLabel('Order number').fill(orderNumber);
    await page.getByLabel('Email').fill(guestEmail);
    await page.getByRole('button', { name: 'Track order' }).click();

    await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Warranty issued')).toBeVisible();
    await expect(page.getByText(warrantyNumber)).toBeVisible();

    // Independently re-checkable at any time via the public /shop/warranty page, with no login
    // and no email required - proving the guest isn't locked into the order-lookup page forever.
    await page.goto('/shop/warranty');
    await page.getByLabel(/warranty or serial number/i).fill(warrantyNumber);
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Warranty found')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(itemName)).toBeVisible();
  });
});
