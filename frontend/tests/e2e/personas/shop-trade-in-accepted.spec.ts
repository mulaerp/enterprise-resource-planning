import { test, expect, type Page } from '@playwright/test';
import { apiLogin, apiGet } from '../../helpers/api-setup';

/**
 * WEBSHOP persona (iii) - POSTAL TRADE-IN, accepted: a customer requests an indicative quote,
 * "posts" the item (delivery method), staff receive it, inspect it and record a final offer,
 * the customer accepts, and staff complete it - producing a REAL trade-in with stock +1,
 * weighted-average acquisitionCost, and store credit, with balanced books throughout.
 *
 * Also proves the oversight cross-feature question: a completed postal trade-in must appear in
 * the branch manager's item trace (as a TRADE_IN_RECEIPT event) and in the money-flow day book
 * (as a store-credit-issued or trade-in-cash-payout total) - it goes through the exact same
 * `PosTradeInService#createTradeIn` an in-store trade-in uses (see `ShopTradeInQuoteService#complete`),
 * so oversight needed no WEBSHOP-specific change to already cover it - verified live, not assumed.
 *
 * The quote-REQUEST leg is UI-driven (customer/guest own account + trade-in form);
 * receive/inspect/complete has no staff-facing UI yet (see the `webshop` skill) so that leg is
 * API-level on a staff page, mirroring `shop-quotes.spec.ts`'s pattern.
 */
test.describe.serial('WEBSHOP persona: POSTAL TRADE-IN (accepted)', () => {
  let managerPage: Page;
  const stamp = Date.now();
  const itemName = `Persona TradeIn Item ${stamp}`;
  const itemSku = `PTRADEIN-${stamp}`;
  const buyPrice = 900; // round MYR worked example, per the `personas` skill convention
  const memberEmail = `persona-tradein-${stamp}@example.com`;

  let memberId: string;
  let quoteNumber: string;
  let productId: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await browser.newPage();
    await apiLogin(managerPage, 'manager@mulaerp.com', 'admin123');

    const memberRes = await managerPage.request.post('/api/v1/members', {
      data: { name: 'Persona TradeIn Member', email: memberEmail, phone: `+601${stamp}`.slice(0, 14) },
    });
    expect(memberRes.ok()).toBeTruthy();
    memberId = (await memberRes.json()).id;

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

  test('member registers/logs in and requests an indicative postal trade-in quote', async ({ page }) => {
    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Persona TradeIn Member');
    await page.getByLabel('Email address').fill(memberEmail);
    await page.getByLabel('Phone').fill('0191234567');
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    await page.goto('/shop/trade-in');
    await page.getByLabel('Search our catalogue').fill(itemName);
    const hit = page.getByRole('button', { name: new RegExp(itemName) });
    await expect(hit).toBeVisible({ timeout: 10000 });
    await hit.click();

    // Signed-in customer - no guest fields to fill (auto-attaches to the account).
    await page.getByRole('button', { name: 'Get my indicative quote' }).click();

    const heading = page.getByRole('heading', { name: /Quote number TQ-/ });
    await expect(heading).toBeVisible({ timeout: 10000 });
    quoteNumber = (await heading.textContent())!.replace('Quote number', '').trim();
    expect(quoteNumber).toMatch(/^TQ-/);
    await expect(page.getByText('Indicative estimate only')).toBeVisible();
  });

  test('staff receive, inspect (final offer within range), customer accepts via account page, staff complete: real trade-in, stock +1, weighted-average cost, store credit, balanced books', async ({
    page,
  }) => {
    const quoteRes = await managerPage.request.get(`/api/v1/shop/admin/quotes?size=50`);
    const quotes = (await quoteRes.json()).content as Array<{ quoteNumber: string; id: string; quotedMin: number; quotedMax: number }>;
    const quote = quotes.find((q) => q.quoteNumber === quoteNumber);
    expect(quote).toBeTruthy();

    const receiveRes = await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/receive`);
    expect(receiveRes.ok(), await receiveRes.text()).toBeTruthy();

    const finalOffer = Math.round((quote!.quotedMin + quote!.quotedMax) / 2 * 100) / 100; // mid-range
    const inspectRes = await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/inspect`, {
      data: { finalOffer, payoutType: 'STORE_CREDIT', notes: 'Confirmed on physical inspection' },
    });
    expect(inspectRes.ok(), await inspectRes.text()).toBeTruthy();
    expect((await inspectRes.json()).finalOfferOutOfRange).toBe(false);

    // Customer logs in and accepts the offer from the account page's Trade-ins tab.
    await page.goto('/shop/login');
    await page.getByLabel('Email address').fill(memberEmail);
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });
    await page.getByRole('button', { name: 'Trade-ins' }).click();
    await expect(page.getByText(quoteNumber)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Accept offer' }).click();
    await expect(page.getByText('ACCEPTED')).toBeVisible({ timeout: 10000 });

    const productBefore = await apiGet(managerPage, `/api/v1/products/${productId}`);
    const memberBefore = await apiGet(managerPage, `/api/v1/members/${memberId}`);

    const completeRes = await managerPage.request.post(`/api/v1/shop/admin/quotes/${quote!.id}/complete`);
    expect(completeRes.ok(), await completeRes.text()).toBeTruthy();
    const completed = await completeRes.json();
    expect(completed.status).toBe('COMPLETED');
    expect(completed.posTradeInId).toBeTruthy();

    // Stock +1, weighted-average acquisitionCost (mirrors PosTradeInService's own formula).
    const productAfter = await apiGet(managerPage, `/api/v1/products/${productId}`);
    expect(productAfter.stockQuantity as number).toBe((productBefore.stockQuantity as number) + 1);
    const existingQty = productBefore.stockQuantity as number;
    const existingCost = (productBefore.acquisitionCost as number) ?? 0;
    const expectedCost = Math.round(((existingCost * existingQty + finalOffer) / (existingQty + 1)) * 100) / 100;
    expect(productAfter.acquisitionCost as number).toBeCloseTo(expectedCost, 2);

    // Store credit issued to the linked loyalty member.
    const memberAfter = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    expect(memberAfter.storeCreditBalance as number).toBeCloseTo((memberBefore.storeCreditBalance as number) + finalOffer, 2);

    // Books balance: PosTradeInService's own inventory journal, verified generically here (house
    // rule - every journal entry must balance, whichever module posted it).
    const journalEntries = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const entries = Array.isArray(journalEntries) ? journalEntries : (journalEntries as { content: unknown[] }).content;
    const tradeInEntries = (entries as Array<Record<string, unknown>>).filter(
      (e) => typeof e.reference === 'string' && (e.reference as string).startsWith('TI-')
    );
    expect(tradeInEntries.length).toBeGreaterThan(0);
    for (const entry of tradeInEntries.slice(-2)) {
      const lines = entry.lines as Array<{ debit: number; credit: number }>;
      expect(lines.reduce((s, l) => s + Number(l.debit), 0)).toBeCloseTo(
        lines.reduce((s, l) => s + Number(l.credit), 0),
        2
      );
    }
  });

  test('cross-feature: the completed trade-in appears in the branch manager item trace and money-flow day book', async () => {
    const trace = await apiGet(managerPage, `/api/v1/oversight/trace/item?sku=${itemSku}`);
    const events = (trace as { events: Array<{ type: string }> }).events;
    expect(events.some((e) => e.type === 'TRADE_IN_RECEIPT')).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    const moneyFlow = await apiGet(managerPage, `/api/v1/oversight/money-flow?from=${today}&to=${today}`);
    const storeCreditIssued = moneyFlow.storeCreditIssued as { amount: number; documents: string[] };
    expect(storeCreditIssued.amount).toBeGreaterThan(0);
  });
});
