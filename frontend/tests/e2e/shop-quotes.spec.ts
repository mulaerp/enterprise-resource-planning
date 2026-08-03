import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';

/**
 * Postal/drop-off trade-in quotes (WEBSHOP owner decision 3) - an INDICATIVE RANGE, valid a
 * configurable number of days, settled by staff inspection on arrival. API-level suite (no
 * dedicated staff-facing UI exists yet for receive/inspect/complete/return - only the
 * customer-facing request/account pages have UI, see `shop-storefront.spec.ts`/personas).
 *
 * Reads directly from:
 *  - backend com.mulaerp.shop.quote.** (entity/repository/service/controller)
 *  - V41__shop_trade_in_quotes.sql / V43__close_legacy_guest_quotes.sql
 *
 * Every identity in this flow (staff/customer A/customer B) uses its own, independently-created
 * `APIRequestContext` (own cookie jar) via `pwRequest.newContext()` - mirrors the pattern in
 * `personas/buyer.spec.ts`/`personas/seller.spec.ts` rather than juggling cookies on a shared
 * `page`.
 *
 * <p><b>MEMBERS-ONLY (OWNER DECISION, 2026-08):</b> online trade-in quote requests now require a
 * `ROLE_SHOP_CUSTOMER` session - the previous guest path (`POST /api/v1/public/shop/quotes`,
 * `GET /api/v1/public/shop/quotes/{quoteNumber}?email=`) has been DELETED outright (not merely
 * hidden), and `SecurityConfig` now `denyAll()`s that whole sub-path (carved out ahead of the
 * general `/api/v1/public/**` permitAll rule) so it can never again be accidentally exposed. Test
 * (a) below, which used to prove the guest happy path, now proves the refusal instead - see also
 * the "members-only" tests further down and `shop-trade-in-declined.spec.ts`'s rewritten
 * "DISCLOSED GAP" test (the guest dead-end this change actually resolves).
 *
 * NOT covered here (documented, not silently skipped): the scheduler-driven QUOTED -> EXPIRED
 * transition (`ShopTradeInQuoteExpiryScheduler`, default cron every 15 minutes) is time-based and
 * has no per-request override - this suite has no DB access to force a row into the past (e2e
 * stays black-box, API/UI only), and waiting a real 7-day (or even 15-minute) window in CI isn't
 * practical. That transition, and the resulting 409 on receive/inspect of an EXPIRED quote, were
 * verified live against a running stack instead (expiresAt manipulated directly in Postgres,
 * scheduler observed to flip the row, then receive/inspect both confirmed to reject it) - see the
 * task's verification report for the transcript. What IS covered here: expiresAt is computed
 * correctly relative to quotedAt (the scheduler's own input), and the state-machine guards
 * (`requireStatus`) reject out-of-order actions generally (proven via the DECLINED->complete 409
 * below) - the same guard EXPIRED would hit.
 */
test.describe.serial('Postal/drop-off trade-in quotes', () => {
  const stamp = Date.now();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

  const buyPrice = 900; // matches this suite's own test product below - keep in sync
  const round2 = (n: number) => Math.round(n * 100) / 100;

  let staffApi: APIRequestContext;
  let customerAApi: APIRequestContext;
  let customerBApi: APIRequestContext;

  let productId: string;
  let stockBeforeAnyCompletion: number;

  const customerAEmail = `quote.customer.a.${stamp}@example.test`;
  const customerBEmail = `quote.customer.b.${stamp}@example.test`;
  const memberEmail = `quote.member.${stamp}@example.test`;

  let memberId: string;

  test.beforeAll(async () => {
    staffApi = await pwRequest.newContext({ baseURL });
    const staffLogin = await staffApi.post('/api/v1/auth/login', {
      data: { email: 'admin@mulaerp.com', password: 'admin123' },
    });
    expect(staffLogin.ok(), `staff login failed: ${staffLogin.status()}`).toBeTruthy();

    // A dedicated, uniquely-SKU'd catalogue product with a known buyPrice - every arithmetic
    // assertion below is anchored to this one figure.
    const categoriesRes = await staffApi.get('/api/v1/products/categories');
    expect(categoriesRes.ok()).toBeTruthy();
    const categories = await categoriesRes.json();
    const consoleCategory =
      categories.find((c: { name: string }) => c.name === 'Consoles') ?? categories[0];

    const productRes = await staffApi.post('/api/v1/products', {
      data: {
        sku: `QUOTE-E2E-${stamp}`,
        name: `Quote Test Console ${stamp}`,
        categoryId: consoleCategory.id,
        unitPrice: 1200.0,
        costPrice: 800.0,
        buyPrice,
        stockQuantity: 3,
        reorderLevel: 1,
        status: 'ACTIVE',
      },
    });
    expect(productRes.ok(), `product create failed: ${productRes.status()}`).toBeTruthy();
    const product = await productRes.json();
    productId = product.id;
    stockBeforeAnyCompletion = product.stockQuantity;

    // A loyalty Member sharing an email with the shop customer we'll register below, so
    // ShopAuthService's auto-link (member found by email at registration) gives that customer a
    // memberId - the prerequisite for a STORE_CREDIT payout (see ShopTradeInQuoteService#resolveMemberId).
    const memberRes = await staffApi.post('/api/v1/members', {
      data: { name: `Quote Member ${stamp}`, phone: `+601${stamp}`.slice(0, 14), email: memberEmail },
    });
    expect(memberRes.ok(), `member create failed: ${memberRes.status()}`).toBeTruthy();
    const member = await memberRes.json();
    memberId = member.id;

    customerAApi = await pwRequest.newContext({ baseURL });
    const regA = await customerAApi.post('/api/v1/shop/auth/register', {
      data: { email: customerAEmail, password: 'password123', fullName: 'Quote Customer A', phone: '+60111111111' },
    });
    expect(regA.ok(), `customer A register failed: ${regA.status()}`).toBeTruthy();
    const loginA = await customerAApi.post('/api/v1/shop/auth/login', {
      data: { email: customerAEmail, password: 'password123' },
    });
    expect(loginA.ok()).toBeTruthy();

    customerBApi = await pwRequest.newContext({ baseURL });
    const regB = await customerBApi.post('/api/v1/shop/auth/register', {
      data: { email: customerBEmail, password: 'password123', fullName: 'Quote Customer B', phone: '+60122222222' },
    });
    expect(regB.ok(), `customer B register failed: ${regB.status()}`).toBeTruthy();
    const loginB = await customerBApi.post('/api/v1/shop/auth/login', {
      data: { email: customerBEmail, password: 'password123' },
    });
    expect(loginB.ok()).toBeTruthy();
  });

  test.afterAll(async () => {
    await staffApi.dispose();
    await customerAApi.dispose();
    await customerBApi.dispose();
  });

  test('(a) MEMBERS-ONLY: a guest is refused when requesting or looking up a trade-in quote - the old permitAll guest path is gone, not just hidden', async ({
    request,
  }) => {
    const guestEmail = `quote.guest.${stamp}@example.test`;

    // The endpoint itself no longer exists (PublicShopQuoteController deleted) AND SecurityConfig
    // now denyAll()s this whole sub-path ahead of the general /api/v1/public/** permitAll rule -
    // an anonymous caller gets 401 (ExceptionTranslationFilter routes a denied anonymous
    // principal to the authenticationEntryPoint, not the accessDeniedHandler), with a message
    // that does NOT read like a generic 404/500 - proving this is a deliberate refusal, not an
    // accident.
    const createRes = await request.post('/api/v1/public/shop/quotes', {
      data: {
        productId,
        declaredCondition: 'GOOD',
        hasBox: true,
        accessories: '1 controller, HDMI cable',
        deliveryMethod: 'POST',
        guestEmail,
        guestName: 'Guest Trader',
        guestPhone: '+60123456789',
      },
      failOnStatusCode: false,
    });
    expect(createRes.status()).toBe(401);
    const createBody = await createRes.json();
    expect(createBody.message).toMatch(/authentication is required/i);

    // The guest lookup endpoint is refused identically - it never even reaches a controller to
    // 404 on a specific quote number, since the whole sub-path is denied at the filter-chain layer.
    const lookupRes = await request.get(
      `/api/v1/public/shop/quotes/SOME-QUOTE-NUMBER?email=${encodeURIComponent(guestEmail)}`,
      { failOnStatusCode: false },
    );
    expect(lookupRes.status()).toBe(401);
  });

  test('(a continued) a signed-in customer CAN still request a quote for the same catalogue item - 201, min < max, arithmetic matches the deterministic formula, expiresAt exactly valid-days ahead, indicative flag present', async () => {
    const before = Date.now();
    const res = await customerAApi.post('/api/v1/shop/quotes', {
      data: {
        productId,
        declaredCondition: 'GOOD',
        hasBox: true,
        accessories: '1 controller, HDMI cable',
        deliveryMethod: 'POST',
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const quote = await res.json();
    expect(quote.shopCustomerId).toBeTruthy();
    expect(quote.guestEmail).toBeNull();

    // quotedMax mirrors TradeInSuggestionService's own formula: buyPrice x conditionMultiplier
    // (GOOD=0.85 default) x (1 + boxBonus, 0.05 default, since hasBox=true here).
    const expectedMax = round2(buyPrice * 0.85 * 1.05);
    const expectedMin = round2(expectedMax * 0.7); // mulaerp.shop.quote.min-factor default 0.7
    expect(quote.quotedMax).toBeCloseTo(expectedMax, 2);
    expect(quote.quotedMin).toBeCloseTo(expectedMin, 2);
    expect(quote.quotedMin).toBeLessThan(quote.quotedMax);

    const quotedAt = new Date(quote.quotedAt).getTime();
    const expiresAt = new Date(quote.expiresAt).getTime();
    const daysBetween = (expiresAt - quotedAt) / (1000 * 60 * 60 * 24);
    expect(daysBetween).toBeCloseTo(7, 1); // mulaerp.shop.quote.valid-days default 7
    expect(quotedAt).toBeGreaterThanOrEqual(before - 5000);

    expect(quote.indicative).toBe(true);
    expect(quote.indicativeMessage).toMatch(/indicative/i);
    expect(quote.indicativeMessage).toMatch(/inspection/i);
    expect(quote.status).toBe('QUOTED');
  });

  let customerAQuoteId: string;

  test('(b) a logged-in customer quote auto-attaches to their account and appears in GET own quotes (not in another customer\'s list)', async () => {
    const res = await customerAApi.post('/api/v1/shop/quotes', {
      data: {
        productId,
        declaredCondition: 'LIKE_NEW',
        hasBox: false,
        deliveryMethod: 'DROP_OFF',
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const quote = await res.json();
    customerAQuoteId = quote.id;
    expect(quote.shopCustomerId).toBeTruthy();
    expect(quote.guestEmail).toBeNull();

    const expectedMax = round2(buyPrice * 0.95 * 1.0); // LIKE_NEW=0.95, no box
    expect(quote.quotedMax).toBeCloseTo(expectedMax, 2);

    const ownList = await customerAApi.get('/api/v1/shop/quotes');
    expect(ownList.ok()).toBeTruthy();
    const ownQuotes = (await ownList.json()).content as Array<{ id: string }>;
    expect(ownQuotes.some((q) => q.id === customerAQuoteId)).toBe(true);

    const otherList = await customerBApi.get('/api/v1/shop/quotes');
    expect(otherList.ok()).toBeTruthy();
    const otherQuotes = (await otherList.json()).content as Array<{ id: string }>;
    expect(otherQuotes.some((q) => q.id === customerAQuoteId)).toBe(false);
  });

  test('(h) customer B cannot accept/decline customer A\'s quote (403) - ownership is checked before status', async () => {
    const acceptAsB = await customerBApi.post(`/api/v1/shop/quotes/${customerAQuoteId}/accept-offer`);
    expect(acceptAsB.status()).toBe(403);
    const declineAsB = await customerBApi.post(`/api/v1/shop/quotes/${customerAQuoteId}/decline-offer`);
    expect(declineAsB.status()).toBe(403);
  });

  test('(d) full CASH settlement: staff receive -> inspect (in range) -> OFFER_MADE; customer accepts -> ACCEPTED; staff completes -> real trade-in, stock +1, weighted-average acquisitionCost, journal all via the existing PosTradeInService', async () => {
    const receiveRes = await staffApi.post(`/api/v1/shop/admin/quotes/${customerAQuoteId}/receive`);
    expect(receiveRes.status(), await receiveRes.text()).toBe(200);
    expect((await receiveRes.json()).status).toBe('RECEIVED');

    const finalOffer = 700.0;
    const inspectRes = await staffApi.post(`/api/v1/shop/admin/quotes/${customerAQuoteId}/inspect`, {
      data: { finalOffer, payoutType: 'CASH', notes: 'Powers on fine, minor scuffs' },
    });
    expect(inspectRes.status(), await inspectRes.text()).toBe(200);
    const inspected = await inspectRes.json();
    expect(inspected.status).toBe('OFFER_MADE');
    expect(inspected.finalOffer).toBe(finalOffer);
    expect(inspected.finalOfferOutOfRange).toBe(false);
    // The original indicative range is still present, distinct from the final offer (task's
    // honesty requirement - a customer can see both).
    expect(inspected.quotedMin).toBeLessThan(inspected.finalOffer);

    const acceptRes = await customerAApi.post(`/api/v1/shop/quotes/${customerAQuoteId}/accept-offer`);
    expect(acceptRes.status(), await acceptRes.text()).toBe(200);
    expect((await acceptRes.json()).status).toBe('ACCEPTED');

    const productBefore = await (await staffApi.get(`/api/v1/products/${productId}`)).json();

    const completeRes = await staffApi.post(`/api/v1/shop/admin/quotes/${customerAQuoteId}/complete`);
    expect(completeRes.status(), await completeRes.text()).toBe(200);
    const completed = await completeRes.json();
    expect(completed.status).toBe('COMPLETED');
    expect(completed.posTradeInId).toBeTruthy();

    // A second complete call must be rejected (not double-applied) - the quote's own state guard.
    const secondComplete = await staffApi.post(`/api/v1/shop/admin/quotes/${customerAQuoteId}/complete`);
    expect(secondComplete.status()).toBe(409);

    const tradeInRes = await staffApi.get(`/api/v1/pos/trade-ins/${completed.posTradeInId}`);
    expect(tradeInRes.ok()).toBeTruthy();
    const tradeIn = await tradeInRes.json();
    expect(tradeIn.payoutType).toBe('CASH');
    expect(tradeIn.payoutTotal).toBe(finalOffer);
    expect(tradeIn.lines).toHaveLength(1);
    expect(tradeIn.lines[0].productId).toBe(productId);
    expect(tradeIn.lines[0].linkedExistingProduct).toBe(true);

    const productAfter = await (await staffApi.get(`/api/v1/products/${productId}`)).json();
    expect(productAfter.stockQuantity).toBe(productBefore.stockQuantity + 1);
    // Weighted-average acquisitionCost - see PosTradeInService#applyWeightedAverageAcquisitionCost.
    const existingQty = productBefore.stockQuantity;
    const existingCost = productBefore.acquisitionCost ?? 0;
    const expectedAcquisitionCost = round2((existingCost * existingQty + finalOffer) / (existingQty + 1));
    expect(productAfter.acquisitionCost).toBeCloseTo(expectedAcquisitionCost, 2);
  });

  test('(d continued) STORE_CREDIT settlement credits the linked loyalty member\'s balance', async () => {
    const customerCApi = await pwRequest.newContext({ baseURL });
    const regC = await customerCApi.post('/api/v1/shop/auth/register', {
      // Same email as the Member created in beforeAll - ShopAuthService auto-links memberId.
      data: { email: memberEmail, password: 'password123', fullName: 'Quote Member Web', phone: '+60133333333' },
    });
    expect(regC.ok(), `customer C register failed: ${regC.status()}`).toBeTruthy();
    const customer = await regC.json();
    expect(customer.memberId).toBe(memberId);
    const loginC = await customerCApi.post('/api/v1/shop/auth/login', {
      data: { email: memberEmail, password: 'password123' },
    });
    expect(loginC.ok()).toBeTruthy();

    const quoteRes = await customerCApi.post('/api/v1/shop/quotes', {
      data: { productId, declaredCondition: 'GOOD', hasBox: false, deliveryMethod: 'POST' },
    });
    expect(quoteRes.status()).toBe(201);
    const quote = await quoteRes.json();

    await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/receive`);
    const finalOffer = round2(quote.quotedMin + (quote.quotedMax - quote.quotedMin) / 2); // mid-range
    const inspectRes = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/inspect`, {
      data: { finalOffer, payoutType: 'STORE_CREDIT', notes: 'Confirmed on inspection' },
    });
    expect(inspectRes.status(), await inspectRes.text()).toBe(200);

    await customerCApi.post(`/api/v1/shop/quotes/${quote.id}/accept-offer`);

    const memberBefore = await (await staffApi.get(`/api/v1/members/${memberId}`)).json();
    const completeRes = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/complete`);
    expect(completeRes.status(), await completeRes.text()).toBe(200);

    const memberAfter = await (await staffApi.get(`/api/v1/members/${memberId}`)).json();
    expect(memberAfter.storeCreditBalance).toBeCloseTo(memberBefore.storeCreditBalance + finalOffer, 2);

    await customerCApi.dispose();
  });

  test('(e) customer declines the offer -> staff returns it -> RETURNED, no stock effect', async () => {
    const quoteRes = await customerBApi.post('/api/v1/shop/quotes', {
      data: { productId, declaredCondition: 'FAIR', hasBox: false, deliveryMethod: 'DROP_OFF' },
    });
    expect(quoteRes.status()).toBe(201);
    const quote = await quoteRes.json();

    await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/receive`);
    await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/inspect`, {
      data: { finalOffer: quote.quotedMin, payoutType: 'CASH', notes: 'As described' },
    });

    const productBefore = await (await staffApi.get(`/api/v1/products/${productId}`)).json();

    const declineRes = await customerBApi.post(`/api/v1/shop/quotes/${quote.id}/decline-offer`);
    expect(declineRes.status(), await declineRes.text()).toBe(200);
    expect((await declineRes.json()).status).toBe('DECLINED');

    // A DECLINED quote can never be completed.
    const completeAttempt = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/complete`);
    expect(completeAttempt.status()).toBe(409);

    const returnRes = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/return`);
    expect(returnRes.status(), await returnRes.text()).toBe(200);
    const returned = await returnRes.json();
    expect(returned.status).toBe('RETURNED');
    expect(returned.posTradeInId).toBeNull();

    const productAfter = await (await staffApi.get(`/api/v1/products/${productId}`)).json();
    expect(productAfter.stockQuantity).toBe(productBefore.stockQuantity);

    // Idempotency guard: a second return attempt is rejected, not silently repeated.
    const secondReturn = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/return`);
    expect(secondReturn.status()).toBe(409);
  });

  test('(g) a final offer outside the quoted range is allowed but requires a recorded reason', async () => {
    const quoteRes = await customerBApi.post('/api/v1/shop/quotes', {
      data: { productId, declaredCondition: 'POOR', hasBox: false, deliveryMethod: 'DROP_OFF' },
    });
    expect(quoteRes.status()).toBe(201);
    const quote = await quoteRes.json();
    await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/receive`);

    const belowRangeOffer = round2(quote.quotedMin - 100);

    const withoutNotes = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/inspect`, {
      data: { finalOffer: belowRangeOffer, payoutType: 'CASH' },
    });
    expect(withoutNotes.status(), await withoutNotes.text()).toBe(400);

    const withNotes = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/inspect`, {
      data: {
        finalOffer: belowRangeOffer,
        payoutType: 'CASH',
        notes: 'Internal fault found on inspection, well below the indicative range',
      },
    });
    expect(withNotes.status(), await withNotes.text()).toBe(200);
    const inspected = await withNotes.json();
    expect(inspected.status).toBe('OFFER_MADE');
    expect(inspected.finalOffer).toBe(belowRangeOffer);
    expect(inspected.finalOfferOutOfRange).toBe(true);
    expect(inspected.inspectionNotes).toBeTruthy();
  });

  test('a quote cannot be inspected before it has been received, and cannot be received twice', async () => {
    const quoteRes = await customerBApi.post('/api/v1/shop/quotes', {
      data: { productId, declaredCondition: 'GOOD', hasBox: false, deliveryMethod: 'POST' },
    });
    const quote = await quoteRes.json();

    const inspectTooEarly = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/inspect`, {
      data: { finalOffer: quote.quotedMin, payoutType: 'CASH', notes: 'n/a' },
    });
    expect(inspectTooEarly.status()).toBe(409);

    const receiveOk = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/receive`);
    expect(receiveOk.status()).toBe(200);

    const receiveAgain = await staffApi.post(`/api/v1/shop/admin/quotes/${quote.id}/receive`);
    expect(receiveAgain.status()).toBe(409);
  });

  test('staff admin list endpoint filters by status', async () => {
    const res = await staffApi.get('/api/v1/shop/admin/quotes?status=RETURNED&size=50');
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.content)).toBe(true);
    for (const q of body.content) {
      expect(q.status).toBe('RETURNED');
    }
  });

  test('REGRESSION (security): a shop-customer session must never reach the staff admin quotes surface', async () => {
    // Found live during the WEBSHOP verification gate: ShopAdminQuoteController had NO
    // controller-level @PreAuthorize, relying on the "any authenticated staff role" shape used
    // safely elsewhere (e.g. PosTradeInController) - safe there only because that controller's
    // path is never touched by ShopCustomerAuthenticationFilter. This controller IS under
    // /api/v1/shop/**, which that filter DOES authenticate against (granting only
    // ROLE_SHOP_CUSTOMER), and the /api/v1/shop/admin/** SecurityConfig matcher was only
    // authenticated() - satisfied just as well by a shop customer as by staff. Before the fix
    // (RoleRules.ANY_STAFF_ROLE added as a class-level @PreAuthorize), a logged-in shop customer
    // could list every customer's/guest's trade-in quotes here and call every mutating endpoint on
    // an arbitrary quote id. Guarded here so a regression trips this suite, not just a manual
    // audit - see RoleRules.ANY_STAFF_ROLE's javadoc for the full explanation.
    const listAsCustomer = await customerAApi.get('/api/v1/shop/admin/quotes');
    expect(listAsCustomer.status()).toBe(403);

    const receiveAsCustomer = await customerAApi.post(`/api/v1/shop/admin/quotes/${customerAQuoteId}/receive`);
    expect(receiveAsCustomer.status()).toBe(403);

    const inspectAsCustomer = await customerAApi.post(`/api/v1/shop/admin/quotes/${customerAQuoteId}/inspect`, {
      data: { finalOffer: 1, payoutType: 'CASH', notes: 'attempted by a shop customer' },
    });
    expect(inspectAsCustomer.status()).toBe(403);

    // Positive control: the exact same staff session used throughout this file still works.
    const listAsStaff = await staffApi.get('/api/v1/shop/admin/quotes');
    expect(listAsStaff.ok()).toBeTruthy();
  });
});
