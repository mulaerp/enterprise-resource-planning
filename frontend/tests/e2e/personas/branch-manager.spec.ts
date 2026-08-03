import { test, expect, type Page } from '@playwright/test';
import { login } from '../../helpers/auth';
import { fieldByLabel, formatMoney, round2, modalByTitle, valueAfterLabel } from '../../helpers/pos';

/**
 * Persona 5 - Branch manager (MANAGER role): end-to-end oversight across item history, cash, and
 * exceptions, plus the one role boundary MANAGER doesn't cross (user management is ADMIN-only).
 *
 * Reads directly from:
 *  - src/pages/oversight/{ItemTracePage,MoneyFlowPage,ExceptionsPage,CashUpPage}.tsx
 *  - src/lib/oversightTrace.ts (event-type labels: "Opening stock", "PoS sale", "Warranty issued")
 *  - backend ItemTraceService (actor = the sale's own createdBy - the cashier who rang it up, not
 *    whoever is browsing the trace), ExceptionsService (deep-discount threshold, default 30%),
 *    CashUpService (expected is always server-recomputed from operational tables; approvedBy is
 *    the authenticated username of whoever saves the count)
 *
 * Two pages are used: `cashierPage` (CASHIER) creates the item and the deep-discount sale so the
 * trace/exceptions data genuinely has a *different* actor than the manager browsing it;
 * `managerPage` (MANAGER) does everything oversight-specific, including editing the product to
 * add a warranty term (STOCK_WRITERS, which CASHIER's own PRODUCT_CREATE-only grant doesn't cover).
 */
test.describe.serial('Persona: Branch manager (MANAGER)', () => {
  let cashierPage: Page;
  let managerPage: Page;
  const stamp = Date.now();
  const itemName = `Manager Trace Item ${stamp}`;
  let itemSku: string;
  let saleNumber: string;

  test.beforeAll(async ({ browser }) => {
    cashierPage = await browser.newPage();
    await login(cashierPage, 'cashier@mulaerp.com', 'admin123');
    managerPage = await browser.newPage();
    await login(managerPage, 'manager@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await cashierPage.close();
    await managerPage.close();
  });

  test('sets up an item, a warranty term, and a deep-discount sale to trace', async () => {
    await cashierPage.goto('/pos/intake');
    itemSku = await fieldByLabel(cashierPage, 'SKU').inputValue();
    await fieldByLabel(cashierPage, 'Item Name').fill(itemName);
    await fieldByLabel(cashierPage, 'Condition').selectOption('GOOD');
    await fieldByLabel(cashierPage, 'Buy Price').fill('0');
    await fieldByLabel(cashierPage, 'Sell Price').fill('100');
    await fieldByLabel(cashierPage, 'Quantity').fill('1');
    await cashierPage.getByRole('button', { name: 'Save Item' }).click();
    await expect(cashierPage.getByText(itemName).first()).toBeVisible({ timeout: 10000 });

    // Warranty months isn't settable from thrift intake (CASHIER's PRODUCT_CREATE grant doesn't
    // include update) - the manager adds it via a product update (STOCK_WRITERS) so the sale below
    // auto-issues a warranty per WarrantyService#autoIssueForPosSaleLine. Done via a direct API
    // call (ProductFormPage.tsx's own PUT contract, mirrored here) rather than driving the edit
    // form itself - that form is already covered by products.spec.ts/audit-and-admin.spec.ts, and
    // this persona's own focus is oversight, not re-proving the product-edit UI.
    const lookup = await managerPage.request.get(`/api/v1/products?search=${itemSku}&size=5`);
    expect(lookup.ok(), `product lookup failed: ${lookup.status()}`).toBeTruthy();
    const found = (await lookup.json()).content.find((p: { sku: string }) => p.sku === itemSku);
    expect(found, `product ${itemSku} not found via API`).toBeTruthy();
    const productId = found.id;

    const updateRes = await managerPage.request.put(`/api/v1/products/${productId}`, {
      data: { ...found, warrantyMonths: 6 },
    });
    expect(updateRes.ok(), `product update failed: ${updateRes.status()}`).toBeTruthy();

    // Hard verification, not just trusting the 200: re-fetch and confirm the field actually
    // persisted, so the sale below genuinely exercises the warranty auto-issue path instead of
    // silently skipping it.
    const verifyRes = await managerPage.request.get(`/api/v1/products/${productId}`);
    expect((await verifyRes.json()).warrantyMonths).toBe(6);

    // A deliberate deep discount: no member, a 40% voucher (ExceptionsService's default
    // deep-discount threshold is 30%) - well above the 50%-of-list-price floor that applies since
    // this product has no cost basis set (Buy Price was 0). Vouchers are RoleRules.MANAGER_UP, so
    // this is created via managerPage's own session (which also thematically fits - the manager
    // setting up a promotion for staff to apply at checkout), not the cashier's.
    const voucherCode = `DEEP${stamp}`;
    const voucherRes = await managerPage.request.post('/api/v1/vouchers', {
      data: { code: voucherCode, type: 'PERCENT', value: 40 },
    });
    expect(voucherRes.ok(), `voucher create failed: ${voucherRes.status()}`).toBeTruthy();

    await cashierPage.goto('/pos');
    const search = cashierPage.getByLabel('Search products');
    await search.fill(itemName);
    await expect(cashierPage.getByText(itemSku)).toBeVisible({ timeout: 10000 });
    await search.press('Enter');

    await cashierPage.getByLabel('Voucher code').fill(voucherCode);
    await cashierPage.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(cashierPage.locator('p', { hasText: /^-RM\s[\d,.]+ applied$/ })).toBeVisible({ timeout: 10000 });

    const expectedTotal = round2(100 - 40); // 40% off RM100
    await cashierPage.getByLabel('Payment method').selectOption('CASH');
    await cashierPage.getByLabel('Amount tendered').fill(expectedTotal.toFixed(2));
    await cashierPage.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(cashierPage, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    saleNumber = ((await valueAfterLabel(confirmation, 'Sale number').textContent()) ?? '').trim();
    expect(saleNumber).toBeTruthy();
  });

  test('traces the item end-to-end: opening stock, the sale with its cashier, and the warranty', async () => {
    await managerPage.goto('/oversight/item-trace');
    await managerPage.getByLabel('SKU').fill(itemSku);
    await managerPage.getByRole('button', { name: 'Trace' }).click();

    await expect(managerPage.getByText(itemName)).toBeVisible({ timeout: 10000 });
    // .first() for each: the event-type label ("Opening stock"/"Warranty issued") and that same
    // event's own detail line can repeat the exact same words (e.g. the opening-stock movement's
    // notes are literally "Opening stock" too) - either match confirms the event is present.
    await expect(managerPage.getByText('Opening stock').first()).toBeVisible();
    await expect(managerPage.getByText('PoS sale').first()).toBeVisible();
    await expect(managerPage.getByText('Warranty issued').first()).toBeVisible();

    const saleEvent = managerPage.locator('li', { hasText: 'PoS sale' });
    await expect(saleEvent).toContainText(saleNumber);
    await expect(saleEvent).toContainText('cashier@mulaerp.com');
  });

  test('opens Money Flow for today: takings split by method are non-zero and the cross-check block renders', async () => {
    await managerPage.goto('/oversight/money-flow');
    await expect(managerPage.getByRole('heading', { name: 'Money Flow / Day Book' })).toBeVisible();

    // The posted-journal cross-check always renders (it may legitimately mismatch while drafts
    // from this run are still unposted - see ExceptionsPage/PostDraftsPage).
    await expect(managerPage.getByText(/operational revenue/i)).toBeVisible({ timeout: 10000 });

    const cashLabel = managerPage.locator('p', { hasText: /^CASH$/ });
    await expect(cashLabel).toBeVisible({ timeout: 10000 });
    const cashAmountText = (await cashLabel.locator('xpath=following-sibling::p[1]').textContent()) ?? '';
    const cashTotal = parseFloat(cashAmountText.replace(/[^0-9.]/g, ''));
    expect(cashTotal).toBeGreaterThan(0);
  });

  test('opens Exceptions and finds the deliberate deep-discount sale', async () => {
    await managerPage.goto('/oversight/exceptions');
    await expect(managerPage.getByRole('heading', { name: 'Exceptions' })).toBeVisible();
    await managerPage.getByRole('button', { name: /^Generate$/ }).click();

    const deepDiscountRow = managerPage.locator('table tbody tr', { hasText: saleNumber });
    await expect(deepDiscountRow).toBeVisible({ timeout: 10000 });
    await expect(deepDiscountRow).toContainText('cashier@mulaerp.com');
    await expect(deepDiscountRow).toContainText('40%');
  });

  test('does a cash-up with a deliberate variance - variance and approver are shown', async () => {
    await managerPage.goto('/oversight/cash-up');
    await expect(managerPage.getByRole('heading', { name: 'Cash-up / Z-Report' })).toBeVisible();

    const cashRow = managerPage.locator('tr', { hasText: 'CASH' });
    await expect(cashRow).toBeVisible({ timeout: 10000 });
    const expectedText = (await cashRow.locator('td').nth(1).textContent()) ?? '';
    const expectedAmount = parseFloat(expectedText.replace(/[^0-9.]/g, ''));

    const counted = round2(expectedAmount - 20); // deliberate RM20 shortfall
    await managerPage.getByLabel('Counted amount for CASH').fill(counted.toFixed(2));
    await managerPage.getByLabel('Notes for CASH').fill('E2E deliberate variance check');
    await managerPage.getByRole('button', { name: /save.*approve/i }).click();
    await expect(managerPage.getByText('Cash-up saved')).toBeVisible({ timeout: 10000 });

    const updatedCashRow = managerPage.locator('tr', { hasText: 'CASH' });
    await expect(updatedCashRow.getByText(`Short ${formatMoney(20)}`)).toBeVisible({ timeout: 10000 });
    await expect(updatedCashRow).toContainText('manager@mulaerp.com');
  });

  test('is blocked from user management', async () => {
    await managerPage.goto('/dashboard');
    await expect(managerPage.getByRole('link', { name: 'Users' })).toHaveCount(0);

    await managerPage.goto('/users');
    // .first(): React StrictMode double-invokes the fetch effect in dev, firing the toast twice.
    await expect(managerPage.getByText('Failed to fetch users').first()).toBeVisible({ timeout: 10000 });
    // DataTable always renders one row for its own empty state ("No data available") rather than
    // zero rows - confirm that placeholder, not an actual user record.
    await expect(managerPage.locator('table tbody tr')).toHaveCount(1);
    await expect(managerPage.getByText('No data available')).toBeVisible();
  });
});
