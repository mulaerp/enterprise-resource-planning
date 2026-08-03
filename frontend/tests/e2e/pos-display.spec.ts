import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { formatMoney, modalByTitle, fieldByLabel, valueAfterLabel } from '../helpers/pos';

/**
 * Point of Sale - customer-facing display (src/pages/pos/DisplayPage.tsx),
 * kept in sync with the register (src/pages/pos/RegisterPage.tsx) via the
 * 'pos-display' BroadcastChannel (src/lib/pos-broadcast.ts). BroadcastChannel
 * works across same-context tabs in Playwright, so both pages live in one
 * test using a second tab from `context.newPage()`.
 */
test.describe('Point of Sale - customer display', () => {
  test('mirrors cart updates and checkout across the register and display in real time', async ({
    page,
    context,
  }) => {
    await login(page);

    // Create an item via intake so the register has something to sell -
    // tolerates a fresh, empty database.
    const stamp = Date.now();
    const itemName = `Display Test Sneakers ${stamp}`;
    await page.goto('/pos/intake');
    const itemSku = await fieldByLabel(page, 'SKU').inputValue();
    await fieldByLabel(page, 'Item Name').fill(itemName);
    await fieldByLabel(page, 'Buy Price').fill('8');
    await fieldByLabel(page, 'Sell Price').fill('20');
    await page.getByRole('button', { name: 'Save Item' }).click();
    // .first(): the saved-item confirmation panel's <strong> and the "Item ...
    // saved" toast both contain itemName.
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });

    // Open the display in a second tab of the SAME context before touching
    // the register, so it starts from the idle "Welcome" state (no leftover
    // broadcast to catch up on).
    const display = await context.newPage();
    await display.goto('/pos/display');
    await expect(display.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.goto('/pos');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');

    await expect(display.getByRole('heading', { name: 'Welcome' })).not.toBeVisible();
    await expect(display.getByText(itemName)).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(display, 'Subtotal')).toHaveText(formatMoney(20));
    await expect(valueAfterLabel(display, 'TOTAL')).toHaveText(formatMoney(20));

    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill('20.00');
    await page.getByRole('button', { name: 'Complete Sale' }).click();
    await expect(modalByTitle(page, 'Sale Complete')).toBeVisible({ timeout: 10000 });

    await expect(display.getByRole('heading', { name: 'Thank You' })).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(display, 'Total Paid')).toHaveText(formatMoney(20));
    await expect(valueAfterLabel(display, 'Change Due')).toHaveText(formatMoney(0));

    await page.getByRole('button', { name: 'New Sale' }).click();
    await expect(display.getByRole('heading', { name: 'Welcome' })).toBeVisible({ timeout: 10000 });

    await display.close();
  });

  test('shows a trade-in-only session on the display before any product is added', async ({ page, context }) => {
    // BUG FIX regression case: a pure trade-in (no cart lines at all) used to never leave the
    // display's idle "Welcome" screen, because the broadcast carried no trade-in information and
    // the display's own state transition only ever checked lines.length. Store credit is the
    // register's default payout mode (RegisterPage.tsx), so this also exercises that default path.
    await login(page);

    const display = await context.newPage();
    await display.goto('/pos/display');
    await expect(display.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.goto('/pos');
    await page.locator('#trade-in-description').fill(`Display Trade-in Only ${Date.now()}`);
    // V38: an unlinked free-text trade-in now REQUIRES a category (so ad-hoc items can't land
    // uncategorised and fragment the catalogue), and Payout/Add-to-Cart stay disabled until one
    // is chosen. Pick the first real category rather than hardcoding an id.
    const displayCategory = page.locator('#trade-in-category');
    await expect(displayCategory).toBeVisible();
    await displayCategory.selectOption({ index: 1 });
    await page.locator('#trade-in-credit-value').fill('40');
    await page.locator('#trade-in-payout-type').selectOption('STORE_CREDIT');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Trade-in added to sale')).toBeVisible({ timeout: 10000 });

    // The display must leave idle purely from the trade-in - there is no product line at all.
    await expect(display.getByRole('heading', { name: 'Welcome' })).not.toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(display, 'Trade-in')).toHaveText(`-${formatMoney(40)}`);

    // With no product in the cart, the trade-in value nets straight against a RM0 total, so the
    // shop owes the customer the full RM40 - "Cash owed to customer" replaces TOTAL, wording
    // consistent with the register's own summary panel.
    await expect(display.getByText('Cash owed to customer')).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(display, 'Cash owed to customer')).toHaveText(formatMoney(40));
    // exact: true - otherwise this substring-matches the always-present "Subtotal" row too.
    await expect(display.getByText('TOTAL', { exact: true })).toHaveCount(0);

    await display.close();
  });

  test('shows "Cash owed to customer" on the display when a part-exchange trade-in exceeds the sale', async ({
    page,
    context,
  }) => {
    await login(page);

    const stamp = Date.now();
    const itemName = `Display Shop Pays Item ${stamp}`;
    await page.goto('/pos/intake');
    const itemSku = await fieldByLabel(page, 'SKU').inputValue();
    await fieldByLabel(page, 'Item Name').fill(itemName);
    await fieldByLabel(page, 'Buy Price').fill('20');
    await fieldByLabel(page, 'Sell Price').fill('50');
    await page.getByRole('button', { name: 'Save Item' }).click();
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });

    const display = await context.newPage();
    await display.goto('/pos/display');
    await expect(display.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.goto('/pos');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');
    await expect(display.getByText(itemName)).toBeVisible({ timeout: 10000 });

    // RM120 trade-in credit against a RM50 sale: the shop owes the customer RM70 (mirrors the
    // personas/seller.spec.ts "part-exchange where the SHOP pays out" scenario, verified here on
    // the customer-facing display rather than the register).
    await page.locator('#trade-in-description').fill(`Display Shop Pays Trade-in ${stamp}`);
    // V38: unlinked free-text trade-ins require a category before Add to Cart enables.
    const pxCategory = page.locator('#trade-in-category');
    await expect(pxCategory).toBeVisible();
    await pxCategory.selectOption({ index: 1 });
    await page.locator('#trade-in-credit-value').fill('120');
    await page.locator('#trade-in-payout-type').selectOption('STORE_CREDIT');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Trade-in added to sale')).toBeVisible({ timeout: 10000 });

    await expect(valueAfterLabel(display, 'Trade-in')).toHaveText(`-${formatMoney(120)}`);
    await expect(display.getByText('Cash owed to customer')).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(display, 'Cash owed to customer')).toHaveText(formatMoney(70));
    // exact: true - otherwise this substring-matches the always-present "Subtotal" row too.
    await expect(display.getByText('TOTAL', { exact: true })).toHaveCount(0);

    await display.close();
  });
});
