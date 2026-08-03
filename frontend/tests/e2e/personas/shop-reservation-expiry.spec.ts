import { test, expect, type Page } from '@playwright/test';
import { apiLogin, apiGet } from '../../helpers/api-setup';

/**
 * WEBSHOP persona (v) - RESERVATION EXPIRY: an unpaid order's reservation expires, the stock
 * returns, and the item becomes purchasable again on the storefront.
 *
 * NOT covered by the automated assertions below (documented, not silently skipped - same approach
 * `shop-quotes.spec.ts` already takes for its own time-based EXPIRED transition): the real
 * time-based trigger itself. `mulaerp.shop.order.reservation-hours` defaults to 48h with no
 * per-request override, and this suite is black-box HTTP/UI only (no DB access from the test
 * runner) - waiting a real 48h in CI isn't practical, and there is no test-only "expire this order
 * now" endpoint (the manual staff trigger, `POST /shop/admin/orders/release-expired`, only ever
 * releases an order that is ALREADY past its `reservedUntil` - see the control test below, which
 * proves it deliberately does NOT touch a fresh one).
 *
 * `ShopOrderService#releaseReservation` is the ONE shared private method both
 * `cancelInternal` (customer/staff cancel) and `releaseExpiredReservations` (the scheduler/manual
 * trigger) call to return stock - same SHOP_RELEASE movement, same "back to purchasable" effect,
 * differing only in which terminal status is set (CANCELLED vs EXPIRED) and the note string. This
 * suite proves that shared mechanism exhaustively via the customer-triggered cancel path (fully
 * automatable), which is the same code the time-based expiry uses.
 *
 * The genuinely time-based trigger was verified live against a running stack instead: a real
 * order's `reserved_until` was set into the past directly in Postgres, the manual release
 * endpoint was called, and the order was confirmed to flip RESERVED -> EXPIRED with stock
 * returned, a SHOP_RELEASE movement recorded, and the storefront showing the item IN_STOCK again
 * - see the WEBSHOP verification gate's report for the full transcript.
 */
test.describe.serial('WEBSHOP persona: RESERVATION EXPIRY', () => {
  let managerPage: Page;
  let customerPage: Page;
  const stamp = Date.now();
  const itemName = `Persona Expiry Item ${stamp}`;
  const itemSku = `PEXPIRY-${stamp}`;
  const customerEmail = `persona-expiry-${stamp}@example.com`;

  let productId: string;
  let orderId: string;
  let orderNumber: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await browser.newPage();
    customerPage = await browser.newPage();
    await apiLogin(managerPage, 'manager@mulaerp.com', 'admin123');

    const productRes = await managerPage.request.post('/api/v1/products', {
      data: {
        sku: itemSku,
        name: itemName,
        unitPrice: 250,
        costPrice: 100,
        acquisitionCost: 100,
        stockQuantity: 1,
        reorderLevel: 0,
        status: 'ACTIVE',
      },
    });
    expect(productRes.ok()).toBeTruthy();
    productId = (await productRes.json()).id;

    const regRes = await customerPage.request.post('/api/v1/shop/auth/register', {
      data: { email: customerEmail, password: 'Password123', fullName: 'Persona Expiry Customer', phone: '+60111222333' },
    });
    expect(regRes.status()).toBe(201);
    const loginRes = await customerPage.request.post('/api/v1/shop/auth/login', {
      data: { email: customerEmail, password: 'Password123' },
    });
    expect(loginRes.ok()).toBeTruthy();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await customerPage.close();
  });

  test('reserving the last unit makes it unavailable on the storefront', async ({ page }) => {
    const orderRes = await customerPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(orderRes.status(), await orderRes.text()).toBe(201);
    const order = await orderRes.json();
    orderId = order.id;
    orderNumber = order.orderNumber;
    expect(order.status).toBe('RESERVED');
    expect(order.reservedUntil).toBeTruthy();

    await page.goto(`/shop/item/${itemSku}`);
    await expect(page.getByText('Out of Stock')).toBeVisible({ timeout: 10000 });
  });

  test('control: a fresh reservation is NOT touched by the release-expired trigger', async () => {
    const releaseRes = await managerPage.request.post('/api/v1/shop/admin/orders/release-expired');
    expect(releaseRes.ok()).toBeTruthy();

    const stillReserved = await apiGet(managerPage, `/api/v1/shop/admin/orders/${orderId}`);
    expect(stillReserved.status).toBe('RESERVED');
  });

  test('once released (via the shared release mechanism), stock returns, a SHOP_RELEASE movement is recorded, and the item is purchasable again', async ({
    page,
  }) => {
    // Exercises ShopOrderService#releaseReservation via the customer-cancel path - the exact same
    // shared method the time-based expiry job calls (see this file's header javadoc).
    const cancelRes = await customerPage.request.post(`/api/v1/shop/orders/${orderId}/cancel`);
    expect(cancelRes.ok(), await cancelRes.text()).toBeTruthy();
    expect((await cancelRes.json()).status).toBe('CANCELLED');

    const productAfter = await apiGet(managerPage, `/api/v1/products/${productId}`);
    expect(productAfter.stockQuantity).toBe(1);

    const movements = await apiGet(managerPage, `/api/v1/inventory/movements?productId=${productId}`);
    const content = (movements as { content: Array<Record<string, unknown>> }).content;
    const releaseMovement = content.find((m) => m.movementType === 'SHOP_RELEASE');
    expect(releaseMovement).toBeTruthy();
    expect(releaseMovement?.quantityDelta).toBe(1);
    expect(releaseMovement?.reference).toBe(orderNumber);

    // Item becomes purchasable again on the storefront.
    await page.goto(`/shop/item/${itemSku}`);
    await expect(page.getByText(/^In Stock$/)).toBeVisible({ timeout: 10000 });

    // And a genuinely new order can now be placed for it - "purchasable again" proven, not just
    // the badge text.
    const secondOrderRes = await customerPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(secondOrderRes.status(), await secondOrderRes.text()).toBe(201);
  });
});
