import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { formatMoney, round2, valueAfterLabel, fieldByLabel } from '../helpers/pos';

/**
 * "My Day" - a cashier's own shift report (GET /api/v1/oversight/my-day), the one oversight-
 * adjacent screen every staff role gets (see src/pages/oversight/MyDayPage.tsx, Layout.tsx's
 * `navItems` with no `roles` restriction on this entry). Backend: OversightMyDayController/
 * MyDayService (com.mulaerp.oversight) - deliberately its own controller, separate from
 * OversightController (whole-class MANAGER_UP), so a CASHIER can reach it at all.
 *
 * The DB this suite runs against is NOT reset between runs (see other e2e specs' use of
 * `Date.now()` stamps to avoid collisions rather than assuming a clean slate) - so this spec
 * reads the cashier's own My Day report via the API BEFORE making its own sale as a baseline,
 * then asserts the sale's own contribution shows up as an exact DELTA on top of that baseline,
 * rather than asserting an absolute total (which would be fragile against whatever else already
 * happened on the account today, including other suites/manual testing runs).
 */
test.describe.serial('Persona: Cashier - My Day', () => {
  let page: Page;
  let itemName: string;
  let itemSku: string;
  let saleNumber: string;
  let cashAmountBefore: number;
  let expectedCashBefore: number;
  const saleTotal = 20; // sell price below, qty 1, no discounts

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, 'cashier@mulaerp.com', 'admin123');

    // Baseline MUST be read before the sale below exists - captured here (beforeAll), not at the
    // start of the second test, since test.describe.serial runs the first test (which creates the
    // sale) before the second one even starts; reading the baseline inside the second test would
    // already include this spec's own sale, making every delta assertion below compare a number
    // against itself (0).
    const today = new Date().toISOString().split('T')[0];
    const baseline = await page.request.get(`/api/v1/oversight/my-day?date=${today}`);
    expect(baseline.ok(), `baseline My Day fetch failed: ${baseline.status()}`).toBeTruthy();
    const baselineBody = await baseline.json();
    const cashMethodBaseline = baselineBody.takingsByPaymentMethod.find(
      (m: { paymentMethod: string; amount: number }) => m.paymentMethod === 'CASH'
    );
    cashAmountBefore = cashMethodBaseline ? cashMethodBaseline.amount : 0;
    expectedCashBefore = baselineBody.expectedCashInDrawer as number;
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('logs a thrift item and completes an exact-tender CASH sale', async () => {
    const stamp = Date.now();
    itemName = `My Day Cash Item ${stamp}`;

    await page.goto('/pos/intake');
    await expect(page.getByRole('heading', { name: 'Item Intake' })).toBeVisible();
    itemSku = await fieldByLabel(page, 'SKU').inputValue();
    expect(itemSku).toBeTruthy();

    await fieldByLabel(page, 'Item Name').fill(itemName);
    await fieldByLabel(page, 'Condition').selectOption('GOOD');
    await fieldByLabel(page, 'Buy Price').fill('5');
    await fieldByLabel(page, 'Sell Price').fill(String(saleTotal));
    await fieldByLabel(page, 'Quantity').fill('1');
    await page.getByRole('button', { name: 'Save Item' }).click();
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/pos');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');
    await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(saleTotal));

    // Exact tender - no change - so the sale's contribution to expectedCashInDrawer is exactly
    // saleTotal, with nothing else to account for.
    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill(saleTotal.toFixed(2));
    await page.getByRole('button', { name: 'Complete Sale' }).click();

    const saleNumberLocator = valueAfterLabel(page, 'Sale number');
    await expect(saleNumberLocator).toBeVisible({ timeout: 10000 });
    saleNumber = ((await saleNumberLocator.textContent()) ?? '').trim();
    expect(saleNumber.length).toBeGreaterThan(0);
  });

  test('shows the sale on My Day with the CASH method and the drawer figure up by exactly its total', async () => {
    const today = new Date().toISOString().split('T')[0];

    await page.goto('/dashboard');
    await page.getByRole('link', { name: /my day/i }).first().click();
    await expect(page).toHaveURL(/\/oversight\/my-day/);
    await expect(page.getByRole('heading', { name: 'My Day' })).toBeVisible();

    // Page defaults to today and loads on mount - wait for the drill-down row for this sale.
    await expect(page.getByText(saleNumber)).toBeVisible({ timeout: 10000 });
    const saleRow = page.locator('tr', { hasText: saleNumber });
    await expect(saleRow.getByText('CASH', { exact: true })).toBeVisible();
    await expect(saleRow.getByText('Completed')).toBeVisible();

    // Re-fetch to compute the exact expected post-sale figures (same rationale as the baseline
    // read above - this sale's own contribution is deterministic regardless of what else is on
    // the account today).
    const after = await page.request.get(`/api/v1/oversight/my-day?date=${today}`);
    const afterBody = await after.json();
    const cashMethodAfter = afterBody.takingsByPaymentMethod.find(
      (m: { paymentMethod: string; amount: number }) => m.paymentMethod === 'CASH'
    );
    expect(cashMethodAfter).toBeTruthy();
    expect(round2(cashMethodAfter.amount - cashAmountBefore)).toBe(saleTotal);

    const expectedCashAfter = afterBody.expectedCashInDrawer as number;
    expect(round2(expectedCashAfter - expectedCashBefore)).toBe(saleTotal);

    // The prominent "Expected Cash in Drawer" figure on the page matches the API's own figure -
    // confirms the UI isn't silently rendering something else.
    await expect(page.getByText('Expected Cash in Drawer')).toBeVisible();
    const drawerCard = page.locator('p', { hasText: 'Expected Cash in Drawer' }).locator('xpath=..');
    await expect(drawerCard.getByText(formatMoney(expectedCashAfter), { exact: true })).toBeVisible();
  });
});
