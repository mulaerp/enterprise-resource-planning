import { test, expect, type Page } from '@playwright/test';
import { apiLogin, apiGet } from '../../helpers/api-setup';

/**
 * WEBSHOP persona (iv) - POSTAL TRADE-IN, DECLINED: a customer declines the staff's final offer
 * after inspection; the item is returned to them; there must be NO stock or journal effect at
 * all - the item never entered inventory, unlike the accepted path (`shop-trade-in-accepted.spec.ts`).
 *
 * Uses a registered/logged-in customer (not a guest) for the actual decline - this is now the
 * ONLY way to request a trade-in quote at all (OWNER DECISION, 2026-08: online trade-in is
 * MEMBERS-ONLY). This resolves a previously-disclosed gap this same suite used to prove live: a
 * guest quote that reached `OFFER_MADE` had NO way at all to ever accept or declined the final
 * offer (`POST /api/v1/shop/quotes/{id}/decline-offer`/`accept-offer` both required a
 * `SHOP_CUSTOMER` session with no public equivalent, and `TradeInQuoteLookupPage.tsx` - the
 * guest's only quote-status screen - had no Accept/Decline buttons wired to anything). Rather than
 * build the missing guest accept/decline path, the owner decision removed the guest path
 * entirely - see the second test below, which now proves the REFUSAL instead of the dead end,
 * and the `webshop` skill / `ShopTradeInQuoteService`'s class javadoc for the full rationale.
 */
test.describe.serial('WEBSHOP persona: POSTAL TRADE-IN (declined)', () => {
  let managerPage: Page;
  const stamp = Date.now();
  const itemName = `Persona TradeIn Decline Item ${stamp}`;
  const itemSku = `PDECLINE-${stamp}`;
  const buyPrice = 900;
  const customerEmail = `persona-decline-${stamp}@example.com`;

  let productId: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await browser.newPage();
    await apiLogin(managerPage, 'manager@mulaerp.com', 'admin123');

    const productRes = await managerPage.request.post('/api/v1/products', {
      data: {
        sku: itemSku,
        name: itemName,
        unitPrice: buyPrice,
        costPrice: 500,
        buyPrice,
        stockQuantity: 3,
        reorderLevel: 0,
        status: 'ACTIVE',
        condition: 'GOOD',
      },
    });
    expect(productRes.ok()).toBeTruthy();
    productId = (await productRes.json()).id;
  });

  test.afterAll(async () => {
    await managerPage.close();
  });

  test('customer requests a quote, staff receive + inspect it, customer declines via account page, staff mark it returned - no stock/journal effect', async ({
    page,
  }) => {
    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Persona Decline Customer');
    await page.getByLabel('Email address').fill(customerEmail);
    await page.getByLabel('Phone').fill('0123456789');
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    await page.goto('/shop/trade-in');
    await page.getByLabel('Search our catalogue').fill(itemName);
    const hit = page.getByRole('button', { name: new RegExp(itemName) });
    await expect(hit).toBeVisible({ timeout: 10000 });
    await hit.click();
    await page.getByRole('button', { name: 'Get my indicative quote' }).click();

    const heading = page.getByRole('heading', { name: /Quote number TQ-/ });
    await expect(heading).toBeVisible({ timeout: 10000 });
    const quoteNumber = (await heading.textContent())!.replace('Quote number', '').trim();

    const productBefore = await apiGet(managerPage, `/api/v1/products/${productId}`);
    const journalsBefore = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const journalRefsBefore = new Set(
      (Array.isArray(journalsBefore) ? journalsBefore : (journalsBefore as { content: Array<{ reference: string }> }).content).map(
        (e: { reference: string }) => e.reference
      )
    );

    const quoteRes = await managerPage.request.get(`/api/v1/shop/admin/quotes?size=50`);
    const quotes = (await quoteRes.json()).content as Array<{ quoteNumber: string; id: string; quotedMin: number }>;
    const quote = quotes.find((q) => q.quoteNumber === quoteNumber);
    expect(quote).toBeTruthy();

    await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/receive`);
    const inspectRes = await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/inspect`, {
      data: { finalOffer: quote!.quotedMin, payoutType: 'CASH', notes: 'Lower than expected on inspection' },
    });
    expect(inspectRes.ok(), await inspectRes.text()).toBeTruthy();

    await page.goto('/shop/account');
    await page.getByRole('button', { name: 'Trade-ins' }).click();
    await expect(page.getByText(quoteNumber)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Decline offer' }).click();
    await expect(page.getByText('DECLINED')).toBeVisible({ timeout: 10000 });

    // A DECLINED quote can never be completed as a real trade-in.
    const completeAttempt = await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/complete`);
    expect(completeAttempt.status()).toBe(409);

    const returnRes = await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/return`);
    expect(returnRes.ok(), await returnRes.text()).toBeTruthy();
    expect((await returnRes.json()).status).toBe('RETURNED');

    // NO stock effect - the item never entered inventory.
    const productAfter = await apiGet(managerPage, `/api/v1/products/${productId}`);
    expect(productAfter.stockQuantity).toBe(productBefore.stockQuantity);
    expect(productAfter.acquisitionCost).toBe(productBefore.acquisitionCost);

    // NO journal effect - no new journal entry referencing anything from this quote/product exists.
    const journalsAfter = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const entriesAfter = Array.isArray(journalsAfter) ? journalsAfter : (journalsAfter as { content: unknown[] }).content;
    const newEntries = (entriesAfter as Array<{ reference: string }>).filter((e) => !journalRefsBefore.has(e.reference));
    const relatedToThisTradeIn = newEntries.filter(
      (e) => e.reference && (e.reference.includes(quoteNumber) || e.reference.startsWith('TI-'))
    );
    expect(relatedToThisTradeIn).toHaveLength(0);
  });

  test('MEMBERS-ONLY (resolves the previously-disclosed gap): a GUEST cannot request a trade-in quote at all any more - refused at the API, and the trade-in page shows a sign-in/register prompt instead of collecting guest contact details', async ({
    page,
    request,
  }) => {
    const guestEmail = `persona-decline-guest-${stamp}@example.com`;

    // Uses the ANONYMOUS `request` fixture (no cookie at all) rather than managerPage.request -
    // the latter carries the staff MULAERP_AUTH cookie from this describe block's beforeAll
    // login, and an AUTHENTICATED-but-denied principal gets 403 (accessDeniedHandler), not 401
    // (ExceptionTranslationFilter only routes to the authenticationEntryPoint for a genuinely
    // anonymous caller) - see SecurityConfig's own comment on the denyAll() matcher.
    //
    // The old guest creation endpoint is gone outright (PublicShopQuoteController deleted) and
    // SecurityConfig denyAll()s the whole /api/v1/public/shop/quotes/** sub-path ahead of the
    // general permitAll rule - a genuinely anonymous guest is refused (401) before ever reaching
    // a controller.
    const guestRes = await request.post('/api/v1/public/shop/quotes', {
      data: {
        productId,
        declaredCondition: 'GOOD',
        hasBox: false,
        deliveryMethod: 'DROP_OFF',
        guestEmail,
        guestName: 'Persona Decline Guest',
        guestPhone: '0123456789',
      },
      failOnStatusCode: false,
    });
    expect(guestRes.status()).toBe(401);

    // The (also now-deleted) guest decline endpoint is refused identically.
    const declineAttempt = await request.post(
      `/api/v1/public/shop/quotes/SOME-QUOTE-NUMBER/decline-offer`,
      { failOnStatusCode: false }
    );
    expect(declineAttempt.status()).toBe(401);

    // The trade-in request page itself never offers a guest path any more - a signed-out visitor
    // sees a sign-in/create-account prompt, with no guest name/email/phone fields anywhere.
    await page.goto('/shop/trade-in');
    await expect(page.getByRole('heading', { name: /account holders/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveCount(0);
    await expect(page.getByLabel('Email address')).toHaveCount(0);
    await expect(page.getByLabel('Phone')).toHaveCount(0);

    // The old guest lookup page now repoints towards sign-in/account rather than performing a
    // quote-number+email lookup - no such fields are collected there either.
    await page.goto('/shop/trade-in/lookup');
    await expect(page.getByRole('heading', { name: 'Check a trade-in quote' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('Quote number')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
  });
});
