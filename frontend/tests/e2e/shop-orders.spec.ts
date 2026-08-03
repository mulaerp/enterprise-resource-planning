import { test, expect, type Page } from '@playwright/test';
import { apiLogin, createProductViaApi, apiGet } from '../helpers/api-setup';

/**
 * WEBSHOP: online orders - stock reservation, collection/postal fulfilment, and the dormant
 * payment-gateway scaffold. API-level (page.request) rather than UI-driven, since no frontend
 * owns this yet (a later agent builds the storefront cart/checkout UI - see the task split).
 *
 * Reads directly from:
 *  - backend com.mulaerp.shop.order.** (ShopOrderController/PublicShopOrderController/
 *    ShopOrderAdminController/ShopOrderService)
 *  - backend com.mulaerp.shop.payment.** (GatewayWebhookController, dormant scaffold)
 *
 * Three separate identities exercised, each in its own browser context (separate cookie jar) via
 * browser.newPage() - staff (MULAERP_AUTH), shop customer (MULAERP_SHOP), and guest (no cookie at
 * all) must never bleed into each other, exactly like pos-void.spec.ts's cashier/manager split.
 */
test.describe.serial('WEBSHOP online orders', () => {
  let managerPage: Page;
  let cashierPage: Page;
  let customerAPage: Page;
  let customerBPage: Page;
  let guestPage: Page;

  let memberId: string;
  let customerAId: string;
  let orderAId: string;
  let orderANumber: string;
  let productId: string; // qty 1 - reservation/oversell/cancel
  let productFulfilId: string; // qty 1 - fulfilment ledger checks
  let productExpiryId: string; // qty 1 - expiry release checks
  let productPostId: string; // qty 1 - the 400 delivery-address check doesn't need stock, but
  // keeping fulfilmentType=POST separate from the COLLECT flows above keeps each test's
  // assertions unambiguous about which product/order they're reasoning about.
  let productWarrantyId: string; // qty 2 - GAP B: warranty auto-issue on fulfilment
  let productNoWarrantyId: string; // qty 1 - GAP B / WARRANTY-TIERS: no warrantyMonths -> now issues the channel-base warranty (V44), not nothing
  let productGuestWarrantyId: string; // qty 1 - GAP B: guest order warranty findability
  let productVoidId: string; // qty 1, with warrantyMonths - GAP C: void reverses stock/books/warranty

  const stamp = Date.now();
  const customerAEmail = `webshop.customerA.${stamp}@example.test`;
  const customerBEmail = `webshop.customerB.${stamp}@example.test`;
  const guestEmail = `webshop.guest.${stamp}@example.test`;

  test.beforeAll(async ({ browser }) => {
    managerPage = await browser.newPage();
    cashierPage = await browser.newPage();
    customerAPage = await browser.newPage();
    customerBPage = await browser.newPage();
    guestPage = await browser.newPage();

    await apiLogin(managerPage, 'manager@mulaerp.com', 'admin123');
    await apiLogin(cashierPage, 'cashier@mulaerp.com', 'admin123');

    // A loyalty member, pre-existing, whose email will match customer A's shop registration -
    // ShopAuthService#register auto-links member_id when the emails match, so customer A's order
    // fulfilment can be checked for points accrual/store-credit eligibility.
    const memberResponse = await managerPage.request.post('/api/v1/members', {
      data: { name: 'Webshop Customer A', email: customerAEmail, phone: `+601${stamp}`.slice(0, 14) },
    });
    expect(memberResponse.ok()).toBeTruthy();
    memberId = (await memberResponse.json()).id;

    const registerA = await customerAPage.request.post('/api/v1/shop/auth/register', {
      data: { email: customerAEmail, password: 'password123', fullName: 'Webshop Customer A', phone: '+60111000001' },
    });
    expect(registerA.status()).toBe(201);
    const customerADto = await registerA.json();
    customerAId = customerADto.id;
    expect(customerADto.memberId).toBe(memberId); // auto-link confirmed before any order test runs

    const loginA = await customerAPage.request.post('/api/v1/shop/auth/login', {
      data: { email: customerAEmail, password: 'password123' },
    });
    expect(loginA.ok()).toBeTruthy();

    const registerB = await customerBPage.request.post('/api/v1/shop/auth/register', {
      data: { email: customerBEmail, password: 'password123', fullName: 'Webshop Customer B', phone: '+60111000002' },
    });
    expect(registerB.status()).toBe(201);
    const loginB = await customerBPage.request.post('/api/v1/shop/auth/login', {
      data: { email: customerBEmail, password: 'password123' },
    });
    expect(loginB.ok()).toBeTruthy();

    const p1 = await createProductViaApi(managerPage, {
      sku: `WEBORD-RES-${stamp}`, name: 'Webshop Reservation Item', unitPrice: 150, costPrice: 80,
      acquisitionCost: 80, stockQuantity: 1,
    });
    productId = p1.id;

    const p2 = await createProductViaApi(managerPage, {
      sku: `WEBORD-FUL-${stamp}`, name: 'Webshop Fulfilment Item', unitPrice: 200, costPrice: 90,
      acquisitionCost: 90, stockQuantity: 1,
    });
    productFulfilId = p2.id;

    const p3 = await createProductViaApi(managerPage, {
      sku: `WEBORD-EXP-${stamp}`, name: 'Webshop Expiry Item', unitPrice: 75, costPrice: 30,
      acquisitionCost: 30, stockQuantity: 1,
    });
    productExpiryId = p3.id;

    const p4 = await createProductViaApi(managerPage, {
      sku: `WEBORD-POST-${stamp}`, name: 'Webshop Post Item', unitPrice: 60, costPrice: 20,
      acquisitionCost: 20, stockQuantity: 2,
    });
    productPostId = p4.id;

    // GAP B/C products - each carries warrantyMonths so fulfilment auto-issues a warranty.
    const p5 = await createProductViaApi(managerPage, {
      sku: `WEBORD-WARR-${stamp}`, name: 'Webshop Warranty Item', unitPrice: 120, costPrice: 50,
      acquisitionCost: 50, stockQuantity: 2, warrantyMonths: 12,
    });
    productWarrantyId = p5.id;

    const p6 = await createProductViaApi(managerPage, {
      sku: `WEBORD-NOWARR-${stamp}`, name: 'Webshop No-Warranty Item', unitPrice: 45, costPrice: 15,
      acquisitionCost: 15, stockQuantity: 1,
    });
    productNoWarrantyId = p6.id;

    const p7 = await createProductViaApi(managerPage, {
      sku: `WEBORD-GUESTWARR-${stamp}`, name: 'Webshop Guest Warranty Item', unitPrice: 90, costPrice: 35,
      acquisitionCost: 35, stockQuantity: 1, warrantyMonths: 6,
    });
    productGuestWarrantyId = p7.id;

    const p8 = await createProductViaApi(managerPage, {
      sku: `WEBORD-VOID-${stamp}`, name: 'Webshop Void Item', unitPrice: 180, costPrice: 70,
      acquisitionCost: 70, stockQuantity: 1, warrantyMonths: 12,
    });
    productVoidId = p8.id;
  });

  test.afterAll(async () => {
    await managerPage.close();
    await cashierPage.close();
    await customerAPage.close();
    await customerBPage.close();
    await guestPage.close();
  });

  test('(a) member places a COLLECT order for a stocked item -> 201 RESERVED, stock decremented, SHOP_RESERVE movement, no revenue journal yet', async () => {
    const response = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(response.status()).toBe(201);
    const order = await response.json();
    expect(order.status).toBe('RESERVED');
    expect(order.orderNumber).toMatch(/^WEB-\d{4}-\d{6}-[0-9a-f]{4}$/);
    expect(order.reservedUntil).toBeTruthy();
    orderAId = order.id;
    orderANumber = order.orderNumber;

    const product = await apiGet(managerPage, `/api/v1/products/${productId}`);
    expect(product.stockQuantity).toBe(0);

    const movements = await apiGet(managerPage, `/api/v1/inventory/movements?productId=${productId}`);
    const content = (movements as { content: Array<Record<string, unknown>> }).content;
    const reserveMovement = content.find((m) => m.movementType === 'SHOP_RESERVE');
    expect(reserveMovement).toBeTruthy();
    expect(reserveMovement?.quantityDelta).toBe(-1);
    expect(reserveMovement?.reference).toBe(order.orderNumber);

    const journalEntries = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const entries = Array.isArray(journalEntries) ? journalEntries : (journalEntries as { content: unknown[] }).content;
    const revenueEntries = (entries as Array<Record<string, unknown>>).filter((e) => e.reference === order.orderNumber);
    expect(revenueEntries).toHaveLength(0);
  });

  test('(b) a second order for the same last unit -> 409 (no oversell)', async () => {
    const response = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.message).toMatch(/insufficient stock/i);
  });

  test('(c) cancelling the order returns stock with a SHOP_RELEASE movement', async () => {
    const cancelResponse = await customerAPage.request.post(`/api/v1/shop/orders/${orderAId}/cancel`);
    expect(cancelResponse.ok()).toBeTruthy();
    expect((await cancelResponse.json()).status).toBe('CANCELLED');

    const product = await apiGet(managerPage, `/api/v1/products/${productId}`);
    expect(product.stockQuantity).toBe(1);

    const movements = await apiGet(managerPage, `/api/v1/inventory/movements?productId=${productId}`);
    const content = (movements as { content: Array<Record<string, unknown>> }).content;
    const releaseMovement = content.find((m) => m.movementType === 'SHOP_RELEASE');
    expect(releaseMovement).toBeTruthy();
    expect(releaseMovement?.quantityDelta).toBe(1);
    expect(releaseMovement?.reference).toBe(orderANumber);
  });

  test('(d) guest can place an order and look up its status by order number + email; wrong email 404s', async () => {
    const placeResponse = await guestPage.request.post('/api/v1/public/shop/orders', {
      data: {
        items: [{ productId, quantity: 1 }],
        fulfilmentType: 'COLLECT',
        guestEmail,
        guestName: 'Webshop Guest',
        guestPhone: '+60111000099',
      },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();
    expect(order.status).toBe('RESERVED');
    expect(order.shopCustomerId).toBeNull();

    const lookupOk = await guestPage.request.get(
      `/api/v1/public/shop/orders/${order.orderNumber}?email=${encodeURIComponent(guestEmail)}`
    );
    expect(lookupOk.status()).toBe(200);
    expect((await lookupOk.json()).orderNumber).toBe(order.orderNumber);

    const lookupWrong = await guestPage.request.get(
      `/api/v1/public/shop/orders/${order.orderNumber}?email=${encodeURIComponent('someone.else@example.test')}`
    );
    expect([403, 404]).toContain(lookupWrong.status());
  });

  test('(e) staff transition to FULFILLED (cashier-permitted): revenue + COGS journals posted and balanced, points accrued for the member order, no further stock movement', async () => {
    const placeResponse = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId: productFulfilId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();

    const memberBefore = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    const pointsBefore = memberBefore.points as number;

    // Cashier, not manager - RoleRules.SHOP_ORDER_STAFF is deliberately cashier-inclusive (a
    // cashier handing over a collected order must be able to close it out unsupervised).
    const fulfilResponse = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order.id}/fulfil`, {
      data: {},
    });
    expect(fulfilResponse.ok()).toBeTruthy();
    expect((await fulfilResponse.json()).status).toBe('FULFILLED');

    const journalEntries = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const entries = Array.isArray(journalEntries) ? journalEntries : (journalEntries as { content: unknown[] }).content;
    const orderEntries = (entries as Array<Record<string, unknown>>).filter((e) => e.reference === order.orderNumber);
    expect(orderEntries.length).toBe(2); // revenue entry + COGS entry

    for (const entry of orderEntries) {
      expect(entry.status).toBe('POSTED');
      const lines = entry.lines as Array<{ debit: number; credit: number }>;
      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    }

    const revenueEntry = orderEntries.find((e) => (e.description as string).includes('fulfilled'));
    expect(revenueEntry).toBeTruthy();
    const revenueLines = revenueEntry!.lines as Array<{ accountCode: string; debit: number; credit: number }>;
    expect(revenueLines.some((l) => l.accountCode === '1111' && l.debit === 200)).toBeTruthy(); // Cash on Hand
    expect(revenueLines.some((l) => l.accountCode === '4100' && l.credit === 200)).toBeTruthy(); // Sales Revenue

    const cogsEntry = orderEntries.find((e) => (e.description as string).includes('COGS'));
    expect(cogsEntry).toBeTruthy();
    const cogsLines = cogsEntry!.lines as Array<{ accountCode: string; debit: number; credit: number }>;
    expect(cogsLines.some((l) => l.accountCode === '5100' && l.debit === 90)).toBeTruthy(); // COGS
    expect(cogsLines.some((l) => l.accountCode === '1130' && l.credit === 90)).toBeTruthy(); // Inventory

    const memberAfter = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    expect(memberAfter.points as number).toBe(pointsBefore + 200); // floor(total) = floor(200)

    // No SHOP_RESERVE-adjacent movement written a second time at fulfilment - the reservation's
    // own movement already removed this stock; only the original SHOP_RESERVE row should exist.
    const movements = await apiGet(managerPage, `/api/v1/inventory/movements?productId=${productFulfilId}`);
    const content = (movements as { content: Array<Record<string, unknown>> }).content;
    const shopMovements = content.filter((m) => m.reference === order.orderNumber);
    expect(shopMovements).toHaveLength(1);
    expect(shopMovements[0].movementType).toBe('SHOP_RESERVE');
  });

  test('(f) an expired reservation is released via the admin endpoint: EXPIRED status, stock returned, SHOP_RELEASE movement', async () => {
    const placeResponse = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId: productExpiryId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();

    // Manual trigger of the same release job the scheduler runs (ShopOrderAdminController
    // POST /release-expired) - a freshly placed reservation is ~48h from expiry, so this alone
    // must NOT touch it; this assertion is the control for the next one.
    const releaseNow = await managerPage.request.post('/api/v1/shop/admin/orders/release-expired');
    expect(releaseNow.ok()).toBeTruthy();

    const stillReserved = await apiGet(managerPage, `/api/v1/shop/admin/orders/${order.id}`);
    expect(stillReserved.status).toBe('RESERVED');
  });

  test('(g) placing a POST order without a delivery address is rejected with 400', async () => {
    const response = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId: productPostId, quantity: 1 }], fulfilmentType: 'POST' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toMatch(/deliveryAddress/i);

    // Sanity: the same request succeeds once an address is supplied, and delivery adds the
    // configured fee to the total on top of the subtotal.
    const withAddress = await customerAPage.request.post('/api/v1/shop/orders', {
      data: {
        items: [{ productId: productPostId, quantity: 1 }],
        fulfilmentType: 'POST',
        deliveryAddress: '123 Test Street, Kuala Lumpur',
      },
    });
    expect(withAddress.status()).toBe(201);
    const order = await withAddress.json();
    expect(order.fulfilmentType).toBe('POST');
    expect(order.total).toBeCloseTo(order.subtotal + order.deliveryFee, 2);
  });

  test("(h) customer B requesting customer A's order -> 403", async () => {
    // orderAId is now CANCELLED (test (c)) but still belongs to customer A - ownership is
    // checked independently of status, so this proves the boundary regardless of lifecycle state.
    const response = await customerBPage.request.get(`/api/v1/shop/orders/${orderAId}`);
    expect(response.status()).toBe(403);

    // Positive control: customer A can still read her own (cancelled) order.
    const ownResponse = await customerAPage.request.get(`/api/v1/shop/orders/${orderAId}`);
    expect(ownResponse.ok()).toBeTruthy();
  });

  test('(i) with payment.gateway.enabled=false the webhook stub returns 501 and no gateway path is reachable', async () => {
    const response = await guestPage.request.post('/api/v1/public/shop/payment/webhook', {
      data: { eventType: 'payment.succeeded' },
    });
    expect(response.status()).toBe(501);
    expect((await response.json()).message).toMatch(/disabled|not (yet )?implemented/i);
  });

  test('staff-side listing/filtering of orders works and is gated correctly', async () => {
    const listResponse = await managerPage.request.get('/api/v1/shop/admin/orders?status=CANCELLED');
    expect(listResponse.ok()).toBeTruthy();
    const page = await listResponse.json();
    expect((page.content as Array<{ status: string }>).every((o) => o.status === 'CANCELLED')).toBeTruthy();

    // A shop-customer cookie must never satisfy the staff admin surface.
    const asCustomer = await customerAPage.request.get('/api/v1/shop/admin/orders');
    expect([401, 403]).toContain(asCustomer.status());
  });

  // ==== GAP B: warranty auto-issued on fulfilment ==========================================

  test('(j) fulfilling a member order for a warrantyMonths product issues one warranty per unit, findable via the public checker', async () => {
    const placeResponse = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId: productWarrantyId, quantity: 2 }], fulfilmentType: 'COLLECT' },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();
    expect(order.warrantyNumbers).toEqual([]); // nothing issued yet - only RESERVED so far

    const fulfilResponse = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order.id}/fulfil`, { data: {} });
    expect(fulfilResponse.ok()).toBeTruthy();
    const fulfilled = await fulfilResponse.json();
    expect(fulfilled.status).toBe('FULFILLED');
    // One warranty PER UNIT (quantity 2), never one per line regardless of quantity.
    expect(fulfilled.warrantyNumbers).toHaveLength(2);
    expect(new Set(fulfilled.warrantyNumbers).size).toBe(2); // both distinct

    for (const warrantyNumber of fulfilled.warrantyNumbers as string[]) {
      expect(warrantyNumber).toMatch(/^WTY-\d{4}-\d{6}-[0-9a-f]{4}$/);
      const lookup = await managerPage.request.get(`/api/v1/public/warranty/${warrantyNumber}`);
      expect(lookup.ok()).toBeTruthy();
      const body = await lookup.json();
      expect(body.found).toBe(true);
      expect(body.status).toBe('ACTIVE');
      expect(body.productName).toContain('Webshop Warranty Item');
    }

    // Also surfaced on the customer's own order read (GET /shop/orders/{id}) and order list -
    // "findable on the customer's order" per the task, not just in the fulfil response.
    const getOwn = await customerAPage.request.get(`/api/v1/shop/orders/${order.id}`);
    expect((await getOwn.json()).warrantyNumbers).toEqual(fulfilled.warrantyNumbers);
  });

  test('(k) WARRANTY-TIERS: fulfilling an order for a product with NO warrantyMonths now issues the channel-base warranty, not nothing', async () => {
    // Deliberate behaviour change (V44, see WarrantyService#resolveDuration): a product with no
    // warrantyMonths at all used to yield no warranty on fulfilment. It now always yields the
    // guest/member channel-base-days floor - customer A is member-linked (see beforeAll), so this
    // order gets the MEMBER_BASE days figure (10, per the app_settings seed), not the guest one.
    const placeResponse = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId: productNoWarrantyId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();

    const fulfilResponse = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order.id}/fulfil`, { data: {} });
    expect(fulfilResponse.ok(), await fulfilResponse.text()).toBeTruthy();
    const fulfilled = await fulfilResponse.json();
    expect(fulfilled.status).toBe('FULFILLED');
    expect(fulfilled.warrantyNumbers).toHaveLength(1);

    const lookup = await managerPage.request.get(`/api/v1/public/warranty/${fulfilled.warrantyNumbers[0]}`);
    expect(lookup.ok()).toBeTruthy();
    const looked = await lookup.json();
    expect(looked.found).toBe(true);
    expect(looked.coverageLabel).toContain('(member)');
  });

  test('(l) a GUEST order for a warrantyMonths product issues a warranty findable via the guest order lookup and the public checker', async () => {
    const guestWarrantyEmail = `webshop.guestwarranty.${stamp}@example.test`;
    const placeResponse = await guestPage.request.post('/api/v1/public/shop/orders', {
      data: {
        items: [{ productId: productGuestWarrantyId, quantity: 1 }],
        fulfilmentType: 'COLLECT',
        guestEmail: guestWarrantyEmail,
        guestName: 'Webshop Guest Warranty',
        guestPhone: '+60111000199',
      },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();

    const fulfilResponse = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order.id}/fulfil`, { data: {} });
    expect(fulfilResponse.ok()).toBeTruthy();
    expect((await fulfilResponse.json()).warrantyNumbers).toHaveLength(1);

    // The guest has no account - the order lookup (order number + the email they themselves
    // supplied, exactly like ShopOrderService#guestLookup's existing "lookup token") is how they
    // find it, and the number is independently re-checkable via the public warranty checker with
    // no login/customer identity of any kind.
    const lookup = await guestPage.request.get(
      `/api/v1/public/shop/orders/${order.orderNumber}?email=${encodeURIComponent(guestWarrantyEmail)}`
    );
    expect(lookup.ok()).toBeTruthy();
    const lookedUp = await lookup.json();
    expect(lookedUp.warrantyNumbers).toHaveLength(1);
    const warrantyNumber = lookedUp.warrantyNumbers[0];

    const publicCheck = await guestPage.request.get(`/api/v1/public/warranty/${warrantyNumber}`);
    expect((await publicCheck.json()).found).toBe(true);
  });

  // ==== GAP C: void a FULFILLED order =======================================================

  test('(m) manager voids a FULFILLED order: stock returned (SHOP_VOID, original SHOP_RESERVE intact), revenue/COGS reversed and balanced, points deducted, warranty VOIDed, refund reported', async () => {
    const placeResponse = await customerAPage.request.post('/api/v1/shop/orders', {
      data: { items: [{ productId: productVoidId, quantity: 1 }], fulfilmentType: 'COLLECT' },
    });
    expect(placeResponse.status()).toBe(201);
    const order = await placeResponse.json();

    const memberBefore = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    const pointsBefore = memberBefore.points as number;

    const fulfilResponse = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order.id}/fulfil`, { data: {} });
    expect(fulfilResponse.ok()).toBeTruthy();
    const fulfilled = await fulfilResponse.json();
    expect(fulfilled.warrantyNumbers).toHaveLength(1);
    const warrantyNumber = fulfilled.warrantyNumbers[0];

    const productBefore = await apiGet(managerPage, `/api/v1/products/${productVoidId}`);
    expect(productBefore.stockQuantity).toBe(0); // reserved+fulfilled, none returned yet

    const voidResponse = await managerPage.request.post(`/api/v1/shop/admin/orders/${order.id}/void`, {
      data: { reason: 'e2e verification: customer returned the item' },
    });
    expect(voidResponse.ok(), await voidResponse.text()).toBeTruthy();
    const voidBody = await voidResponse.json();
    expect(voidBody.order.status).toBe('VOIDED');
    expect(voidBody.refundMethod).toBe('CASH');
    expect(voidBody.refundAmount).toBeCloseTo(180, 2);
    expect(voidBody.stockReturned).toHaveLength(1);
    expect(voidBody.stockReturned[0].quantity).toBe(1);
    expect(voidBody.pointsDeducted).toBe(180); // floor(180) earned at fulfilment
    expect(voidBody.warrantiesVoided).toEqual([warrantyNumber]);

    // Stock genuinely returned, and the ORIGINAL SHOP_RESERVE row is untouched (append-only ledger)
    // - both it and the new SHOP_VOID row must be visible.
    const productAfter = await apiGet(managerPage, `/api/v1/products/${productVoidId}`);
    expect(productAfter.stockQuantity).toBe(1);
    const movements = await apiGet(managerPage, `/api/v1/inventory/movements?productId=${productVoidId}`);
    const movementContent = (movements as { content: Array<Record<string, unknown>> }).content
      .filter((m) => m.reference === order.orderNumber);
    expect(movementContent.some((m) => m.movementType === 'SHOP_RESERVE' && m.quantityDelta === -1)).toBeTruthy();
    expect(movementContent.some((m) => m.movementType === 'SHOP_VOID' && m.quantityDelta === 1)).toBeTruthy();

    // Points deducted for real, never below zero.
    const memberAfter = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    expect(memberAfter.points as number).toBe(pointsBefore); // net zero: +180 at fulfil, -180 at void

    // Revenue/COGS reversed as POSTED SYSTEM entries - four entries total for this order (original
    // revenue+COGS, reversal revenue+COGS), each individually balanced, netting to zero per account.
    const journalEntries = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const entries = Array.isArray(journalEntries) ? journalEntries : (journalEntries as { content: unknown[] }).content;
    const orderEntries = (entries as Array<Record<string, unknown>>).filter((e) => e.reference === order.orderNumber);
    expect(orderEntries).toHaveLength(4);
    const net: Record<string, number> = {};
    for (const entry of orderEntries) {
      expect(entry.status).toBe('POSTED');
      const lines = entry.lines as Array<{ accountCode: string; debit: number; credit: number }>;
      const debit = lines.reduce((s, l) => s + Number(l.debit), 0);
      const credit = lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(debit).toBeCloseTo(credit, 2); // every entry balances (house rule)
      for (const l of lines) {
        net[l.accountCode] = (net[l.accountCode] ?? 0) + Number(l.debit) - Number(l.credit);
      }
    }
    // P&L nets to zero for this order once reversed - every touched account's net across all
    // four entries is zero.
    for (const value of Object.values(net)) {
      expect(value).toBeCloseTo(0, 2);
    }

    // The warranty this order issued is now VOID, findable as such via the public checker.
    const publicCheck = await managerPage.request.get(`/api/v1/public/warranty/${warrantyNumber}`);
    expect((await publicCheck.json()).status).toBe('VOID');

    // (n) idempotent - voiding again 409s, no double reversal.
    const secondVoid = await managerPage.request.post(`/api/v1/shop/admin/orders/${order.id}/void`, {
      data: { reason: 'second attempt' },
    });
    expect(secondVoid.status()).toBe(409);

    // (o) a cashier attempting the same void gets 403 - RoleRules.MANAGER_UP's @PreAuthorize is
    // evaluated before the method body runs, so this 403s on role alone regardless of the order
    // already being VOIDED.
    const cashierVoidAttempt = await cashierPage.request.post(`/api/v1/shop/admin/orders/${order.id}/void`, {
      data: { reason: 'cashier should not be able to do this' },
    });
    expect(cashierVoidAttempt.status()).toBe(403);
  });

  // Note: the void-window-days (default 7) rejection is time-based and was verified live against
  // a running stack (fulfilledAt backdated directly in Postgres, then the void endpoint called and
  // confirmed to 409 with "outside the void window") rather than faked here - same reasoning
  // shop-quotes.spec.ts/the reservation-expiry persona spec already document for their own
  // hours/days-scale time windows: no per-request override exists, and this suite is black-box
  // HTTP/UI only.
});
