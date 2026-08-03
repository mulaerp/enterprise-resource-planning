import { test, expect } from '@playwright/test';

/**
 * Public B2C storefront ('/', '/shop/*') - entirely anonymous, no login.
 * Reads directly from:
 *  - src/pages/public/StorefrontPage.tsx
 *  - src/pages/public/StorefrontItemPage.tsx
 *  - src/pages/public/WarrantyCheckPage.tsx
 *  - src/components/PublicLayout.tsx
 *  - src/lib/storefront-format.ts (condition/stock-status labels)
 *  - src/lib/money.ts (formatMoney/formatInCurrency) + src/contexts/CurrencyContext.tsx
 *    (the currency-switcher wiring - MYR renders as "RM<nbsp>1,234.50" by default,
 *    not "$", see the CURRENCY module spec)
 *
 * No test in this file logs in - every page.goto() below runs in a fresh,
 * unauthenticated browser context, which also covers the ProtectedRoute
 * regression check (anonymous /dashboard -> /login).
 *
 * The catalogue has ~500 imported items (see the SHOP module import), so
 * these tests rely on that data existing rather than creating their own -
 * unlike the rest of the suite, the public storefront has no authoring UI.
 */

test.describe('Public storefront', () => {
  test('renders the shop with header nav and a product grid', async ({ page }) => {
    await page.goto('/');

    // PublicLayout header: brand name + nav links (Shop / Warranty Check / Staff login).
    await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Warranty Check' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Shop', level: 1 })).toBeVisible();

    // Product grid - each card links to /shop/item/:sku.
    const cards = page.locator('a[href^="/shop/item/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    expect(await cards.count()).toBeGreaterThan(1);
  });

  test('search narrows the product grid to matching items', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('a[href^="/shop/item/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const search = page.getByLabel('Search products');
    await search.fill('NINTENDO SWITCH 2');

    // The console's own listing shows up...
    await expect(page.getByText('NINTENDO SWITCH 2', { exact: true })).toBeVisible({ timeout: 10000 });
    // ...and an unrelated item from a different category is filtered out.
    await expect(page.getByText('007 FIRST LIGHT', { exact: true })).not.toBeVisible();
  });

  test('a category chip filters the product grid', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('a[href^="/shop/item/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    const chip = page.getByRole('button', { name: /^PS5 Games \(\d+\)$/ });
    await expect(chip).toBeVisible({ timeout: 10000 });
    await chip.click();

    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // Every visible card's category line should now read "PS5 Games".
    const categoryTexts = await page.locator('a[href^="/shop/item/"] p.text-xs').allTextContents();
    expect(categoryTexts.length).toBeGreaterThan(0);
    for (const text of categoryTexts) {
      expect(text).toBe('PS5 Games');
    }

    // "All" resets the filter.
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('a product card shows a WE SELL price and stock badge, and opens the item detail page', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('a[href^="/shop/item/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    await expect(firstCard.getByText(/^WE SELL RM/)).toBeVisible();
    await expect(firstCard.getByText(/In Stock|Low Stock|Out of Stock/)).toBeVisible();

    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/shop\/item\/.+/);
    const itemName = (await firstCard.locator('h2').textContent())?.trim();

    await firstCard.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));

    // Wait for the item's own heading first - the listing grid's cards (each
    // rendering their own "WE SELL RM..." line) can still be present in the DOM
    // for a beat during the route swap, which would otherwise make the WE SELL
    // text-locator below ambiguous.
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible({ timeout: 10000 });

    // Detail page: condition badge + WE SELL price.
    await expect(page.getByText(/^WE SELL RM/)).toBeVisible();
    await expect(page.getByText(/^New$|^Like New$|^Good$|^Fair$|^Poor$/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /check warranty/i })).toBeVisible();
  });

  test('currency switcher converts a product card price and shows the approximation note', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('a[href^="/shop/item/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const priceLocator = firstCard.getByText(/^WE SELL/);
    const myrPriceText = (await priceLocator.textContent())?.trim();
    expect(myrPriceText).toMatch(/^WE SELL RM/);

    // The approximation note only renders once a non-MYR currency is
    // selected (see StorefrontPage.tsx) - absent on the MYR default.
    const note = page.getByText('Prices are approximate conversions from MYR');
    await expect(note).not.toBeVisible();

    // Wait for `GET /public/currencies` to populate the <select> with USD
    // etc. (it starts out MYR-only via the fallback in CurrencyContext.tsx) -
    // switching to a not-yet-registered option is a no-op.
    const currencySelect = page.locator('#shop-currency');
    await expect(currencySelect.locator('option[value="USD"]')).toHaveCount(1, { timeout: 10000 });
    await currencySelect.selectOption('USD');

    await expect(note).toBeVisible();
    await expect(priceLocator).toHaveText(/^WE SELL \$/);
    await expect(priceLocator).not.toHaveText(myrPriceText!);

    // Switching back to MYR restores the original price and hides the note.
    await currencySelect.selectOption('MYR');
    await expect(note).not.toBeVisible();
    await expect(priceLocator).toHaveText(myrPriceText!);
  });

  test('warranty checker shows a not-found message for an invalid code', async ({ page }) => {
    await page.goto('/shop/warranty');
    await expect(page.getByRole('heading', { name: 'Warranty Check', level: 1 })).toBeVisible();

    await page.getByLabel(/warranty or serial number/i).fill('NOT-A-REAL-CODE-000');
    await page.getByRole('button', { name: 'Check' }).click();

    await expect(page.getByText('No warranty found for that number.')).toBeVisible({ timeout: 10000 });
  });

  test('"Staff login" link navigates to /login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Staff login' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('an authenticated-only route still redirects anonymous visitors to /login (ProtectedRoute regression)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
