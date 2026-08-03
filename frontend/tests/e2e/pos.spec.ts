import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { formatMoney, round2, valueAfterLabel, modalByTitle, fieldByLabel } from '../helpers/pos';
import { createProductViaApi, apiGet } from '../helpers/api-setup';

/**
 * Point of Sale - register, checkout, and offline queueing.
 *
 * Every scenario creates its own item/voucher/member through the UI so the
 * suite tolerates a fresh, empty database. Reads directly from:
 *  - src/pages/pos/RegisterPage.tsx
 *  - src/pages/pos/IntakePage.tsx
 *  - src/pages/pos/VoucherFormPage.tsx
 *  - src/lib/pos-offline.ts (pos_product_cache_v1 / pos_sale_queue_v1)
 */

test.describe.serial('Point of Sale - register', () => {
  let page: Page;
  let itemName: string;
  let itemSku: string;
  let voucherCode: string;
  let saleNumberOne: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('loads with the header and an online indicator', async () => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Point of Sale', level: 1 })).toBeVisible();
    await expect(page.getByText('Online', { exact: true })).toBeVisible();
  });

  test('logs a thrift item via intake and a 10% voucher', async () => {
    const stamp = Date.now();
    itemName = `Thrift Denim Jacket ${stamp}`;
    voucherCode = `TENOFF${stamp}`;

    await page.goto('/pos/intake');
    await expect(page.getByRole('heading', { name: 'Item Intake' })).toBeVisible();

    // SKU is auto-suggested on mount - capture it before it disappears behind
    // the "Saved" confirmation panel.
    itemSku = await fieldByLabel(page, 'SKU').inputValue();
    expect(itemSku).toBeTruthy();

    await fieldByLabel(page, 'Item Name').fill(itemName);
    await fieldByLabel(page, 'Condition').selectOption('GOOD');
    await fieldByLabel(page, 'Buy Price').fill('10');
    await fieldByLabel(page, 'Sell Price').fill('25');
    // This describe block sells this same item twice further down (once CASH, once CARD) -
    // Quantity defaults to 1, which leaves the second sale with zero stock.
    await fieldByLabel(page, 'Quantity').fill('2');
    await page.getByLabel('Tags').fill('vintage, denim');
    await page.getByLabel('Tags').press('Enter');
    await expect(page.getByText('vintage', { exact: true })).toBeVisible();
    await expect(page.getByText('denim', { exact: true })).toBeVisible();
    await page.getByLabel('Includes original box').check();

    await page.getByRole('button', { name: 'Save Item' }).click();
    // .first(): the saved-item confirmation panel's <strong> and the "Item ...
    // saved" toast both contain itemName.
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });

    // Create the voucher the register flow will apply later.
    await page.goto('/pos/vouchers/new');
    await expect(page.getByRole('heading', { name: 'Add New Voucher' })).toBeVisible();
    await fieldByLabel(page, 'Code').fill(voucherCode);
    await fieldByLabel(page, 'Type').selectOption('PERCENT');
    await fieldByLabel(page, 'Value').fill('10');
    await page.getByRole('button', { name: 'Create Voucher' }).click();
    await expect(page).toHaveURL(/\/pos\/vouchers$/, { timeout: 10000 });
    await expect(page.getByText(voucherCode)).toBeVisible();
  });

  test('builds a cart, applies a member and a voucher, then completes a CASH sale', async () => {
    const baseSubtotal = 25; // 1 unit @ $25 sell price, settled after the qty/price edits below.

    await test.step('search and add to cart via Enter', async () => {
      await page.goto('/pos');
      const search = page.getByLabel('Search products');
      await search.fill(itemName);
      await expect(page.getByText(itemSku)).toBeVisible();
      await search.press('Enter');
      await expect(page.getByText('No items yet.')).not.toBeVisible();
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(25));
      await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(25));
    });

    await test.step('quantity +/- updates line and cart totals', async () => {
      await page.getByRole('button', { name: `Increase quantity of ${itemName}` }).click();
      await expect(valueAfterLabel(page, 'Line total')).toHaveText(formatMoney(50));
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(50));

      await page.getByRole('button', { name: `Decrease quantity of ${itemName}` }).click();
      await expect(valueAfterLabel(page, 'Line total')).toHaveText(formatMoney(25));
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(25));
    });

    await test.step('price override recalculates the line and cart totals', async () => {
      const priceInput = page.getByLabel('Price');
      await priceInput.fill('30');
      await expect(valueAfterLabel(page, 'Line total')).toHaveText(formatMoney(30));
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(30));

      // Settle back to the original sell price for predictable downstream math.
      await priceInput.fill('25');
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(25));
    });

    await test.step('line removal empties the cart, then re-add via click', async () => {
      await page.getByRole('button', { name: `Remove ${itemName} from cart` }).click();
      await expect(page.getByText('No items yet.')).toBeVisible();
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(0));

      const search = page.getByLabel('Search products');
      await search.fill(itemName);
      const resultButton = page.locator('button').filter({ hasText: itemSku }).first();
      await expect(resultButton).toBeVisible({ timeout: 10000 });
      await resultButton.click();
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(baseSubtotal));
    });

    let memberDiscountAmount = 0;
    await test.step('quick-create a member at register', async () => {
      await page.getByRole('button', { name: 'Add Member' }).click();
      const memberModal = modalByTitle(page, 'Add Member');
      const memberTimestamp = Date.now();
      const memberName = `Member ${memberTimestamp}`;
      await memberModal.getByLabel('Name').fill(memberName);
      // Phone is a unique column - a hardcoded value collides with earlier runs against a
      // non-fresh database.
      await memberModal.getByLabel('Phone').fill(`012${`${memberTimestamp}`.slice(-8)}`);
      await memberModal.getByRole('button', { name: 'Add Member' }).click();
      await expect(memberModal).toHaveCount(0);

      const memberCard = page.locator('p', { hasText: /tier ·/ });
      await expect(memberCard).toBeVisible({ timeout: 10000 });
      const memberCardText = (await memberCard.textContent()) ?? '';
      const percentMatch = memberCardText.match(/(\d+(?:\.\d+)?)%\s*discount applied/);
      const memberDiscountPercent = percentMatch ? parseFloat(percentMatch[1]) : 0;
      memberDiscountAmount = round2(baseSubtotal * (memberDiscountPercent / 100));

      await expect(valueAfterLabel(page, 'Member discount')).toHaveText(`-${formatMoney(memberDiscountAmount)}`);
    });

    await test.step('an invalid voucher code shows an error', async () => {
      await page.getByLabel('Voucher code').fill('NOPE-INVALID-CODE');
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      // The backend's actual message for an unknown code is "Voucher not found" (a 200 with
      // valid:false, not an error response) - broadened to match that alongside generic
      // invalid/fail wording other voucher-rejection paths might use.
      await expect(page.getByText(/invalid|fail|not found/i)).toBeVisible({ timeout: 10000 });
      await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(round2(baseSubtotal - memberDiscountAmount)));
    });

    let expectedTotal = 0;
    await test.step('a valid voucher applies a discount row and reduces the total', async () => {
      const voucherInput = page.getByLabel('Voucher code');
      await voucherInput.fill(voucherCode);
      await page.getByRole('button', { name: 'Apply', exact: true }).click();

      // \s tolerates the non-breaking space Intl puts between "RM" and the digits
      const appliedLine = page.locator('p', { hasText: /^-RM\s[\d,.]+ applied$/ });
      await expect(appliedLine).toBeVisible({ timeout: 10000 });
      const appliedText = (await appliedLine.textContent()) ?? '';
      const voucherMatch = appliedText.match(/-RM\s([\d,.]+) applied/);
      const voucherDiscountAmount = voucherMatch ? parseFloat(voucherMatch[1].replace(/,/g, '')) : 0;
      expect(voucherDiscountAmount).toBeGreaterThan(0);

      // Not valueAfterLabel() here: there are two exact-text "Voucher" elements on the page -
      // the section <h3> above the code input (first in DOM order) and this summary
      // breakdown row (second) - and the helper's .first() grabs the heading, whose next
      // sibling is the whole applied-voucher badge (code + discount concatenated), not the
      // discount-only summary value. .last() targets the actual summary row.
      await expect(page.locator(':text-is("Voucher") + *').last()).toHaveText(`-${formatMoney(voucherDiscountAmount)}`);
      expectedTotal = round2(baseSubtotal - memberDiscountAmount - voucherDiscountAmount);
      await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(expectedTotal));
    });

    await test.step('CASH checkout shows change and a sale confirmation', async () => {
      const tendered = round2(expectedTotal + 10);
      await page.getByLabel('Payment method').selectOption('CASH');
      await page.getByLabel('Amount tendered').fill(tendered.toFixed(2));
      await expect(page.getByText(`Change: ${formatMoney(10)}`)).toBeVisible();

      await page.getByRole('button', { name: 'Complete Sale' }).click();

      const confirmation = modalByTitle(page, 'Sale Complete');
      await expect(confirmation).toBeVisible({ timeout: 10000 });
      await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(expectedTotal));
      await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(10));

      const saleNumberLocator = valueAfterLabel(page, 'Sale number');
      saleNumberOne = (await saleNumberLocator.textContent()) ?? '';
      expect(saleNumberOne.trim().length).toBeGreaterThan(0);

      await page.getByRole('button', { name: 'New Sale' }).click();
      await expect(confirmation).toHaveCount(0);
      await expect(page.getByText('No items yet.')).toBeVisible();
      await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(0));
    });
  });

  test('completes a second sale via CARD with no tendered-amount input', async () => {
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');

    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(25));
    // Member discount/Voucher rows always render with a leading "-" (even at $0.00 - see the
    // CASH-sale test's "quick-create a member" step above, which relies on that same format).
    await expect(valueAfterLabel(page, 'Member discount')).toHaveText(`-${formatMoney(0)}`);
    // Not valueAfterLabel() here: the section <h3>Voucher</h3> above the code input is also
    // exact-text "Voucher" and comes first in DOM order (see the CASH-sale test's voucher
    // step above for the same collision) - .last() targets the summary breakdown row.
    await expect(page.locator(':text-is("Voucher") + *').last()).toHaveText(`-${formatMoney(0)}`);
    await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(25));

    await page.getByLabel('Payment method').selectOption('CARD');
    await expect(page.getByLabel('Amount tendered')).toHaveCount(0);

    await page.getByRole('button', { name: 'Complete Sale' }).click();

    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(25));
    await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(0));

    const saleNumberTwo = (await valueAfterLabel(page, 'Sale number').textContent()) ?? '';
    expect(saleNumberTwo.trim().length).toBeGreaterThan(0);
    expect(saleNumberTwo).not.toBe(saleNumberOne);

    await page.getByRole('button', { name: 'New Sale' }).click();
    await expect(confirmation).toHaveCount(0);
  });
});

test.describe.serial('Point of Sale - offline queueing', () => {
  let page: Page;
  let itemName: string;
  let itemSku: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);

    // Warm the product catalogue via intake, same as the register describe
    // block above - each describe block creates its own data independently.
    const stamp = Date.now();
    itemName = `Offline Thrift Beanie ${stamp}`;
    await page.goto('/pos/intake');
    itemSku = await fieldByLabel(page, 'SKU').inputValue();
    await fieldByLabel(page, 'Item Name').fill(itemName);
    await fieldByLabel(page, 'Buy Price').fill('4');
    await fieldByLabel(page, 'Sell Price').fill('12');
    // This block sells this same item twice below (once online in "warms the product
    // cache", once offline/queued in "a sale made while offline is queued locally") -
    // Quantity defaults to 1, which leaves the second sale with zero stock once the
    // queued one syncs. Provision 2 so both legitimately have stock.
    await fieldByLabel(page, 'Quantity').fill('2');
    await page.getByRole('button', { name: 'Save Item' }).click();
    // .first(): the saved-item confirmation panel's <strong> and the "Item ...
    // saved" toast both contain itemName.
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('an online sale warms the product cache', async () => {
    await page.goto('/pos');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');
    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(12));

    // Default payment method is Cash, which requires a tendered amount >= total or the
    // register treats it as insufficient and disables Complete Sale entirely (no error shown,
    // no observable effect from clicking it - it just silently does nothing).
    await page.getByLabel('Amount tendered').fill('12.00');
    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'New Sale' }).click();
    await expect(confirmation).toHaveCount(0);

    const cache = await page.evaluate(() => localStorage.getItem('pos_product_cache_v1'));
    expect(cache).toContain(itemSku);
  });

  test('a sale made while offline is queued locally', async () => {
    await page.context().setOffline(true);

    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText('Showing cached results (offline)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');
    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(12));

    // Default payment method is Cash, which requires a tendered amount >= total or
    // Complete Sale is disabled entirely - see RegisterPage's insufficientCash check.
    await page.getByLabel('Amount tendered').fill('12.00');
    await page.getByRole('button', { name: 'Complete Sale' }).click();

    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(confirmation.getByText(/Queued \(offline\)/)).toBeVisible();

    await page.getByRole('button', { name: 'New Sale' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(page.getByText(/Offline/)).toBeVisible();
    await expect(page.getByText(/1 queued/)).toBeVisible();

    const queue = await page.evaluate(() => localStorage.getItem('pos_sale_queue_v1'));
    const queuedSales = JSON.parse(queue ?? '[]');
    expect(queuedSales.length).toBe(1);
  });

  test('going back online syncs and drains the queue', async () => {
    await page.context().setOffline(false);

    await expect(page.getByText(/synced \(was queued offline\)/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Online', { exact: true })).toBeVisible();

    await expect
      .poll(async () => {
        const queue = await page.evaluate(() => localStorage.getItem('pos_sale_queue_v1'));
        return JSON.parse(queue ?? '[]').length;
      }, { timeout: 10000 })
      .toBe(0);
  });
});

test.describe.serial('Point of Sale - trade-in catalogue linking (V38)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('suggest finds an existing product, linking it pre-fills offers and increments stock (weighted-average cost) instead of creating a duplicate', async () => {
    const stamp = Date.now();
    const productName = `TradeLink Console ${stamp}`;

    // buyPrice 200, acquisitionCost 150, stockQuantity 3 - chosen so the weighted-average
    // arithmetic below comes out to clean 2dp figures.
    const product = await createProductViaApi(page, {
      name: productName,
      sku: `TL-${stamp}`,
      unitPrice: 500,
      buyPrice: 200,
      acquisitionCost: 150,
      stockQuantity: 3,
      reorderLevel: 0,
      status: 'ACTIVE',
    });

    // (a) the suggest endpoint itself returns a sensible ranked candidate for this product.
    const suggestions = (await apiGet(
      page,
      `/api/v1/pos/trade-ins/suggest?q=${encodeURIComponent(productName)}&condition=GOOD`
    )) as unknown as Array<{ productId: string; suggestedCashOffer: number; suggestedCreditOffer: number }>;
    const apiMatch = suggestions.find((s) => s.productId === product.id);
    expect(apiMatch, 'suggest endpoint should surface the just-created product').toBeTruthy();
    // 200 (buyPrice) x 0.85 (GOOD) = 170.00 cash; 170 x 1.20 (credit premium) = 204.00 credit
    // (well under unitPrice 500, so the never-exceed-unitPrice clamp doesn't kick in here).
    expect(apiMatch?.suggestedCashOffer).toBe(170);
    expect(apiMatch?.suggestedCreditOffer).toBe(204);

    // (b) condition changes the offer per the configured multipliers - POOR (0.50) is a much lower
    // cash offer than NEW (1.00) for the identical product.
    const poorSuggestions = (await apiGet(
      page,
      `/api/v1/pos/trade-ins/suggest?q=${encodeURIComponent(productName)}&condition=POOR`
    )) as unknown as Array<{ productId: string; suggestedCashOffer: number }>;
    const newSuggestions = (await apiGet(
      page,
      `/api/v1/pos/trade-ins/suggest?q=${encodeURIComponent(productName)}&condition=NEW`
    )) as unknown as Array<{ productId: string; suggestedCashOffer: number }>;
    const poorOffer = poorSuggestions.find((s) => s.productId === product.id)?.suggestedCashOffer;
    const newOffer = newSuggestions.find((s) => s.productId === product.id)?.suggestedCashOffer;
    expect(poorOffer).toBe(100); // 200 x 0.50
    expect(newOffer).toBe(200); // 200 x 1.00
    expect(poorOffer).toBeLessThan(newOffer as number);

    // (c) now drive the actual Register UI: select the candidate and confirm it pre-fills the
    // offer fields as clearly-marked suggestions.
    await page.goto('/pos');
    await page.locator('#trade-in-condition').selectOption('GOOD');
    await page.locator('#trade-in-description').fill(productName);

    const suggestionButton = page.getByRole('option', { name: new RegExp(productName) });
    await expect(suggestionButton).toBeVisible({ timeout: 10000 });
    await expect(suggestionButton).toContainText(product.sku);
    await suggestionButton.click();

    await expect(page.getByText(`Linked to ${productName}`, { exact: false })).toBeVisible();
    await expect(page.locator('#trade-in-cash-value')).toHaveValue('170');
    await expect(page.locator('#trade-in-credit-value')).toHaveValue('204');
    // No category select for a linked item - the existing product already has one.
    await expect(page.locator('#trade-in-category')).toHaveCount(0);

    // Manually overwrite the cash offer, then use the "reset to suggested" affordance - the edit
    // must not be silently clobbered by the Condition re-suggest, and Reset must restore exactly
    // the suggested value.
    await page.locator('#trade-in-cash-value').fill('999');
    const resetButton = page.getByRole('button', { name: 'Reset cash offer to the suggested value' });
    await expect(resetButton).toBeVisible();
    await resetButton.click();
    await expect(page.locator('#trade-in-cash-value')).toHaveValue('170');

    // (c continued) pay out this first linked trade-in in CASH at the suggested rate.
    await page.locator('#trade-in-payout-type').selectOption('CASH');
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.getByText(/paid out - RM\s?170\.00/)).toBeVisible({ timeout: 10000 });

    // Stock incremented on the SAME product (no duplicate created), and acquisitionCost became
    // the weighted average: existingQty 3 @ RM150 (basis 450) + 1 @ RM170 = 620 / 4 = RM155.00.
    const afterFirst = await apiGet(page, `/api/v1/products/${product.id}`);
    expect(afterFirst.stockQuantity).toBe(4);
    expect(Number(afterFirst.acquisitionCost)).toBe(155);

    // (c continued) trade in the SAME product a second time, at a different (manually overridden)
    // cost, to prove the weighted average accumulates correctly across repeated trade-ins rather
    // than resetting.
    await page.goto('/pos');
    await page.locator('#trade-in-description').fill(productName);
    const secondSuggestionButton = page.getByRole('option', { name: new RegExp(productName) });
    await expect(secondSuggestionButton).toBeVisible({ timeout: 10000 });
    await secondSuggestionButton.click();
    await page.locator('#trade-in-cash-value').fill('200');
    await page.locator('#trade-in-payout-type').selectOption('CASH');
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.getByText(/paid out - RM\s?200\.00/)).toBeVisible({ timeout: 10000 });

    // existingQty 4 @ RM155 (basis 620) + 1 @ RM200 = 820 / 5 = RM164.00.
    const afterSecond = await apiGet(page, `/api/v1/products/${product.id}`);
    expect(afterSecond.stockQuantity).toBe(5);
    expect(Number(afterSecond.acquisitionCost)).toBe(164);

    // Both trade-ins wrote their own TRADE_IN_RECEIPT movement against this one product - no
    // second product was ever created for either trade-in.
    const movements = (await apiGet(page, `/api/v1/inventory/movements?productId=${product.id}`)) as unknown as {
      content: { movementType: string; quantityDelta: number }[];
    };
    const receipts = movements.content.filter((m) => m.movementType === 'TRADE_IN_RECEIPT');
    expect(receipts.length).toBe(2);
    expect(receipts.every((m) => m.quantityDelta === 1)).toBe(true);
  });

  test('an unlinked (free-text) trade-in without a category is blocked, and with one creates a new categorised product', async () => {
    const stamp = Date.now();
    const description = `Unmatched Thrift Oddity ${stamp}`;

    await page.goto('/pos');
    await page.locator('#trade-in-description').fill(description);
    await page.locator('#trade-in-cash-value').fill('42');
    await page.locator('#trade-in-payout-type').selectOption('CASH');

    // No suggestion exists for this made-up description, so the Category select must appear and
    // block Payout until one is chosen.
    const categorySelect = page.locator('#trade-in-category');
    await expect(categorySelect).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Payout' })).toBeDisabled();

    await expect.poll(async () => categorySelect.locator('option').count(), { timeout: 10000 }).toBeGreaterThan(1);
    const categoryOption = categorySelect.locator('option').nth(1);
    const categoryName = (await categoryOption.textContent())?.trim() ?? '';
    await categorySelect.selectOption({ index: 1 });

    await expect(page.getByRole('button', { name: 'Payout' })).toBeEnabled();
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.getByText(/paid out - RM\s?42\.00/)).toBeVisible({ timeout: 10000 });

    // A brand-new, categorised product was created for this unlinked line.
    const search = page.getByLabel('Search products');
    await search.fill(description);
    await expect(page.getByText(formatMoney(42))).toBeVisible({ timeout: 10000 });
    expect(categoryName.length).toBeGreaterThan(0);
  });

  test('optional AI reranker: when enabled, the register UI marks the AI-chosen row and never introduces an off-list SKU', async () => {
    // com.mulaerp.ai.OllamaTradeInMatcher / mulaerp.tradein.ai-match.enabled (default false) - a
    // local LLM reranker that may pick the best-matching candidate from the SAME deterministic
    // list TradeInSuggestionService already retrieved, and parse condition/hasBox/accessories
    // hints out of the free-text query. It never changes suggestedCashOffer/suggestedCreditOffer
    // and can never point at a product that wasn't already a candidate (validated server-side).
    //
    // The suite runs with the feature OFF by default (application-test.yml / CI, and this repo's
    // default docker compose stack) - so this test self-skips whenever the backend didn't mark
    // any row, and only exercises the UI badge/pre-fill behaviour on a box that was deliberately
    // brought up with `docker compose --profile ai up -d ollama` + TRADEIN_AI_MATCH_ENABLED=true.
    const stamp = Date.now();
    const productName = `AI Match Console ${stamp}`;
    const product = await createProductViaApi(page, {
      name: productName,
      sku: `AIM-${stamp}`,
      unitPrice: 500,
      buyPrice: 200,
      stockQuantity: 3,
      reorderLevel: 0,
      status: 'ACTIVE',
    });

    // A misspelling a cashier might plausibly type - the kind of query the deterministic trigram
    // path handles less confidently than a clean token, which is exactly the AI reranker's job.
    const query = productName.replace('Console', 'consol');
    const suggestions = (await apiGet(
      page,
      `/api/v1/pos/trade-ins/suggest?q=${encodeURIComponent(query)}&condition=GOOD`
    )) as unknown as Array<{
      productId: string;
      aiSuggested?: boolean;
      aiMatch?: { applied: boolean; suggestedSku: string | null } | null;
    }>;

    // HARD safety-rail check, runs regardless of whether the feature is enabled: no row's aiMatch
    // can ever reference a productId that isn't itself present in this same suggestions array -
    // i.e. the AI can never surface a product it wasn't handed as a candidate.
    const candidateIds = new Set(suggestions.map((s) => s.productId));
    for (const s of suggestions) {
      if (s.aiMatch?.applied) {
        expect(candidateIds.has(s.productId), 'AI-marked row must be one of the retrieved candidates').toBe(true);
      }
    }

    const aiRow = suggestions.find((s) => s.productId === product.id && s.aiSuggested);
    test.skip(!aiRow, 'AI reranker is disabled (mulaerp.tradein.ai-match.enabled=false, the default) - nothing to verify here');

    await page.goto('/pos');
    await page.locator('#trade-in-description').fill(query);

    const suggestionButton = page.getByRole('option', { name: new RegExp(productName) });
    await expect(suggestionButton).toBeVisible({ timeout: 10000 });
    await expect(suggestionButton.getByText('AI suggested')).toBeVisible();
  });
});
