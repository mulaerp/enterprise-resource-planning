import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

/**
 * WEBSHOP: cart + checkout + guest/member orders (still guest-or-member) + postal trade-in quotes
 * (MEMBERS-ONLY as of 2026-08, see TradeInQuotePage's own javadoc), on top of the existing
 * anonymous storefront (`storefront.spec.ts` / `personas/buyer.spec.ts` cover plain browsing and
 * are re-run alongside this file, not duplicated here).
 *
 * Reads directly from:
 *  - src/contexts/CartContext.tsx (localStorage cart)
 *  - src/pages/shop/{CartPage,CheckoutPage,OrderConfirmationPage,OrderLookupPage,
 *    TradeInQuotePage,TradeInQuoteLookupPage,ShopAccountPage}.tsx
 *  - src/pages/public/{StorefrontPage,StorefrontItemPage}.tsx (Add to cart)
 *  - src/components/PublicLayout.tsx (cart icon/link, Sell/Trade-in nav)
 *  - backend PublicShopOrderController/ShopOrderController/ShopQuoteController (all real, live
 *    calls - no mocking; the old PublicShopQuoteController has been deleted, see below)
 *
 * Preconditions (fresh product per test, cashier-authenticated) mirror
 * `personas/buyer.spec.ts`'s pattern: a separate `cashierApi` APIRequestContext, never touched by
 * the anonymous `page` fixture, so every `page.goto()` below is a genuinely anonymous browser
 * session (or, where a test explicitly registers/logs in, a genuinely fresh shop-customer
 * session) - never one that merely happens to carry a staff cookie.
 */
test.describe('WEBSHOP storefront: cart, checkout, orders, trade-in quotes', () => {
  const stamp = Date.now();
  let cashierApi: APIRequestContext;

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

  async function createProduct(nameSuffix: string, opts: { stockQuantity?: number; buyPrice?: number } = {}) {
    const name = `Shop E2E ${nameSuffix} ${stamp}`;
    const sku = `SHOPE2E-${nameSuffix}-${stamp}`;
    const res = await cashierApi.post('/api/v1/products', {
      data: {
        sku,
        name,
        unitPrice: 250,
        costPrice: 100,
        acquisitionCost: 100,
        stockQuantity: opts.stockQuantity ?? 3,
        reorderLevel: 0,
        status: 'ACTIVE',
        condition: 'GOOD',
        buyPrice: opts.buyPrice ?? 150,
      },
    });
    expect(res.ok(), `product create failed: ${res.status()}`).toBeTruthy();
    return { name, sku };
  }

  async function addToCartFromGrid(page: Page, itemName: string) {
    await page.goto('/');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    const cardLink = page.locator('a[href^="/shop/item/"]', { hasText: itemName });
    await expect(cardLink).toBeVisible({ timeout: 10000 });
    // AddToCartButton is a sibling <button> immediately after the Link inside the same card
    // <div> (see StorefrontPage.tsx) - not nested inside the anchor - so its accessible parent
    // container is the Link's own parent element.
    const card = cardLink.locator('xpath=..');
    await expect(card.getByRole('button', { name: /add to cart/i })).toBeVisible({ timeout: 10000 });
    await card.getByRole('button', { name: /add to cart/i }).click();
    await expect(card.getByRole('button', { name: /added/i })).toBeVisible();
  }

  test('GUEST adds an item to the cart and checks out for collection', async ({ page }) => {
    const { name } = await createProduct('collect');

    await addToCartFromGrid(page, name);

    await page.getByRole('link', { name: /view cart/i }).click();
    await expect(page).toHaveURL(/\/shop\/cart$/);
    await expect(page.getByText(name)).toBeVisible();

    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL(/\/shop\/checkout$/);

    await page.getByLabel('Full name').fill('Guest Collector');
    await page.getByLabel('Email address').fill(`guest-collect-${stamp}@example.com`);
    await page.getByLabel('Phone').fill('0123456789');
    // Collect at store is the default-checked fulfilment radio - no need to touch it.

    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page).toHaveURL(/\/shop\/order-confirmation\/WEB-/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
    await expect(page.getByText(/^WEB-\d{4}-/)).toBeVisible();
    await expect(page.getByText(/held until/i)).toBeVisible();
  });

  test('GUEST postage checkout requires a delivery address', async ({ page }) => {
    const { name } = await createProduct('postage');

    await addToCartFromGrid(page, name);
    await page.getByRole('link', { name: /view cart/i }).click();
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();

    await page.getByLabel('Full name').fill('Guest Poster');
    await page.getByLabel('Email address').fill(`guest-post-${stamp}@example.com`);
    await page.getByLabel('Phone').fill('0123456789');

    // Second fulfilment radio (index 1) is Postage - see CheckoutPage.tsx.
    await page.locator('input[name="fulfilmentType"]').nth(1).check();
    await expect(page.getByLabel('Delivery address')).toBeVisible();

    // Submit without an address - the page's own client-side check should block it.
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByText(/delivery address is required/i)).toBeVisible();
    await expect(page).toHaveURL(/\/shop\/checkout$/);

    // Filling the address and resubmitting succeeds.
    await page.getByLabel('Delivery address').fill('123 Jalan Test, 50000 Kuala Lumpur');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/shop\/order-confirmation\/WEB-/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
  });

  test('a REGISTERED customer logs in, checks out, and sees the order in /shop/account history', async ({ page }) => {
    const { name } = await createProduct('member');
    const email = `member-${stamp}@example.com`;

    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Member Buyer');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill('0198765432');
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    await addToCartFromGrid(page, name);
    await page.getByRole('link', { name: /view cart/i }).click();
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();

    // Signed-in customer sees their own details, not the guest form.
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveCount(0);

    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/shop\/order-confirmation\/(WEB-\S+)/, { timeout: 10000 });
    const url = page.url();
    const orderNumber = url.split('/').pop()!;

    await page.goto('/shop/account');
    await page.getByRole('button', { name: 'Orders' }).click();
    await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 10000 });
  });

  // MEMBERS-ONLY (OWNER DECISION, 2026-08): online trade-in quote requests now require a
  // signed-in shop customer - see TradeInQuotePage's own javadoc. Both tests below register a
  // fresh member first; the old guest quote-request/lookup flow they used to cover no longer
  // exists (see `shop-quotes.spec.ts` test (a) and `personas/shop-trade-in-declined.spec.ts` for
  // the API-level and refusal-UI proof of that removal - this file focuses on the still-working
  // signed-in happy path).
  async function registerAndLoginMember(page: Page, email: string, fullName: string) {
    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Phone').fill('0198765432');
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });
  }

  test('a signed-in member requests a trade-in quote and sees an indicative range + expiry', async ({ page }) => {
    const { name } = await createProduct('tradein', { buyPrice: 200 });
    await registerAndLoginMember(page, `quote-member-${stamp}@example.com`, 'Quote Member');

    await page.goto('/shop/trade-in');
    await page.getByLabel('Search our catalogue').fill(name);
    const hit = page.getByRole('button', { name: new RegExp(name) });
    await expect(hit).toBeVisible({ timeout: 10000 });
    await hit.click();

    // Signed-in customer - no guest contact fields to fill (auto-attaches to the account).
    await expect(page.getByLabel('Full name')).toHaveCount(0);
    await page.getByRole('button', { name: 'Get my indicative quote' }).click();

    await expect(page.getByRole('heading', { name: /Quote number TQ-/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Indicative estimate only')).toBeVisible();
    // The big headline range (p.text-3xl) - the same "RM x - RM y" substring also appears
    // inside the amber indicativeMessage box just below it, so scope to the specific element.
    await expect(page.locator('p.text-3xl')).toHaveText(/RM[\s\u00a0]?[\d,.]+ - RM[\s\u00a0]?[\d,.]+/);
    // Both fragments sit in the same paragraph (see TradeInQuotePage.tsx) - matched together so
    // this doesn't also match the separate amber indicativeMessage box, which contains neither.
    await expect(page.getByText(/Valid until.*not a firm price/i)).toBeVisible();
  });

  test('a signed-out visitor sees a sign-in/register prompt on the trade-in page (no guest contact fields), and the old lookup page repoints towards the account area', async ({
    page,
  }) => {
    await page.goto('/shop/trade-in');
    await expect(page.getByRole('heading', { name: /account holders/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveCount(0);
    await expect(page.getByLabel('Email address')).toHaveCount(0);

    // Quotes now live in /shop/account - the old guest lookup-by-quote-number+email page no
    // longer collects those fields, it just points the visitor there / towards sign-in.
    await page.goto('/shop/trade-in/lookup');
    await expect(page.getByRole('heading', { name: 'Check a trade-in quote' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('Quote number')).toHaveCount(0);
    await expect(page.getByLabel('Email')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
  });

  test('no staff nav/sidebar is present on any public storefront page', async ({ page }) => {
    const { name } = await createProduct('navcheck');

    for (const path of ['/', '/shop/cart', '/shop/trade-in', '/shop/trade-in/lookup', '/shop/orders/lookup', '/shop/login']) {
      await page.goto(path);
      await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Point of Sale' })).toHaveCount(0);
    }

    // Checkout page too, once there's something in the cart to check out.
    await addToCartFromGrid(page, name);
    await page.goto('/shop/checkout');
    await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
  });
});
