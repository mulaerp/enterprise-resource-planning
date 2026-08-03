import { test, expect, type Page } from '@playwright/test';
import { login } from '../../helpers/auth';
import { formatMoney, round2, valueAfterLabel, modalByTitle, fieldByLabel } from '../../helpers/pos';
import { apiGet } from '../../helpers/api-setup';

/**
 * Persona 1 - Seller (shop staff / cashier, CASHIER role).
 *
 * Exercises the full PoS register surface a real thrift-shop cashier touches in a day: item
 * intake, cash/card/e-wallet checkout, member discount + voucher stacking, store-credit
 * redemption, standalone trade-in payouts (cash and store credit), part-exchange (both directions
 * of the net-cash calculation), and the role boundary that keeps a cashier out of oversight and
 * financial reporting.
 *
 * Reads directly from:
 *  - src/pages/pos/RegisterPage.tsx (cart, member, voucher, trade-in, store-credit, checkout)
 *  - src/pages/pos/IntakePage.tsx (thrift item intake)
 *  - backend PosSaleService/PosTradeInService/MemberService (the money/points/store-credit math
 *    asserted below mirrors those services' contracts)
 *
 * Money figures are kept as round MYR numbers per the personas skill's worked-figures convention,
 * except where a discount is a tier-driven percentage (member/voucher stacking) - those percentages
 * are read from the UI itself (same pattern pos.spec.ts already uses) rather than hardcoded, since
 * the exact discount is a business rule this spec shouldn't need to duplicate.
 */
test.describe.serial('Persona: Seller (CASHIER)', () => {
  let page: Page;
  const stamp = Date.now();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, 'cashier@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await page.close();
  });

  /** Intake one thrift item via the UI and return its name/SKU. Mirrors IntakePage.tsx's fields. */
  async function intakeItem(opts: {
    name: string;
    buyPrice: number;
    sellPrice: number;
    quantity?: number;
  }): Promise<{ name: string; sku: string }> {
    await page.goto('/pos/intake');
    await expect(page.getByRole('heading', { name: 'Item Intake' })).toBeVisible();

    // SKU is auto-suggested on mount - capture it before it disappears behind the "Saved" panel.
    const sku = await fieldByLabel(page, 'SKU').inputValue();
    expect(sku).toBeTruthy();

    await fieldByLabel(page, 'Item Name').fill(opts.name);
    await fieldByLabel(page, 'Condition').selectOption('GOOD');
    await fieldByLabel(page, 'Buy Price').fill(String(opts.buyPrice));
    await fieldByLabel(page, 'Sell Price').fill(String(opts.sellPrice));
    await fieldByLabel(page, 'Quantity').fill(String(opts.quantity ?? 1));

    await page.getByRole('button', { name: 'Save Item' }).click();
    // .first(): the saved-item confirmation panel's <strong> and the "Item ... saved" toast
    // both contain the name.
    await expect(page.getByText(opts.name).first()).toBeVisible({ timeout: 10000 });

    return { name: opts.name, sku };
  }

  /** Search-and-add a single unit of a previously intaken item to the register cart. */
  async function addToCart(itemName: string, sku: string): Promise<void> {
    await page.goto('/pos');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(sku)).toBeVisible({ timeout: 10000 });
    await search.press('Enter');
  }

  async function startNewSale(): Promise<void> {
    await page.getByRole('button', { name: 'New Sale' }).click();
  }

  /**
   * V38: a free-text trade-in description that doesn't match anything in the catalogue now
   * requires a Category before Payout/Add to Cart is enabled (see RegisterPage's Trade-In panel -
   * TradeInSuggestionService). Every synthetic item name below is unique-per-run (timestamped) and
   * not expected to link to an existing product, so each of those flows picks whatever real
   * category the seeded/imported catalogue offers first - which one doesn't matter for this spec,
   * only that one is selected.
   */
  async function selectAnyTradeInCategory(): Promise<void> {
    const select = page.locator('#trade-in-category');
    await expect(select).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => select.locator('option').count(), { timeout: 10000 }).toBeGreaterThan(1);
    await select.selectOption({ index: 1 });
  }

  test('loads the register for the cashier', async () => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Point of Sale', level: 1 })).toBeVisible();
  });

  test('intakes an item (buy RM100 / sell RM250) and sells it for CASH with change asserted', async () => {
    const { name, sku } = await intakeItem({ name: `Seller Denim Jacket ${stamp}`, buyPrice: 100, sellPrice: 250 });
    await addToCart(name, sku);

    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(250));
    await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(250));

    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill('300.00');
    await expect(page.getByText(`Change: ${formatMoney(50)}`)).toBeVisible();

    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(250));
    await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(50));

    await startNewSale();
  });

  test('intakes another item and sells it by CARD', async () => {
    const { name, sku } = await intakeItem({ name: `Seller Vinyl Player ${stamp}`, buyPrice: 50, sellPrice: 150 });
    await addToCart(name, sku);

    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(150));
    await page.getByLabel('Payment method').selectOption('CARD');
    await expect(page.getByLabel('Amount tendered')).toHaveCount(0);

    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(150));
    await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(0));

    await startNewSale();
  });

  test('intakes a third item and sells it by E-WALLET', async () => {
    const { name, sku } = await intakeItem({ name: `Seller Skateboard ${stamp}`, buyPrice: 30, sellPrice: 80 });
    await addToCart(name, sku);

    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(80));
    await page.getByLabel('Payment method').selectOption('EWALLET');
    await expect(page.getByLabel('Amount tendered')).toHaveCount(0);

    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(80));

    await startNewSale();
  });

  let stackingMemberId: string;
  let stackingMemberPhone: string;

  test('a sale stacking member discount + voucher: bootstraps a member to SILVER tier first', async () => {
    const bootstrapItem = await intakeItem({ name: `Seller Bootstrap Item ${stamp}`, buyPrice: 200, sellPrice: 500 });
    await addToCart(bootstrapItem.name, bootstrapItem.sku);

    // Quick-create the member at register (same UI pattern as pos.spec.ts).
    await page.getByRole('button', { name: 'Add Member' }).click();
    const memberModal = modalByTitle(page, 'Add Member');
    const memberName = `Stacking Member ${stamp}`;
    stackingMemberPhone = `017${`${stamp}`.slice(-8)}`;
    await memberModal.getByLabel('Name').fill(memberName);
    await memberModal.getByLabel('Phone').fill(stackingMemberPhone);
    await memberModal.getByRole('button', { name: 'Add Member' }).click();
    await expect(memberModal).toHaveCount(0);
    await expect(page.getByText(memberName)).toBeVisible({ timeout: 10000 });

    // A brand-new member is BASIC (0% discount) - this RM500 sale earns exactly 500 points
    // (pointsEarned = floor(salesRevenueAmount), per PosSaleService), crossing the SILVER
    // threshold (>=500 points, 5% discount) for the next sale.
    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill('500.00');
    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Points earned')).toHaveText('500');

    await startNewSale();

    // Look up the member's id via the members list so the trade-in/store-credit tests below can
    // hit its API directly (search box supports name/phone).
    await page.goto('/pos/members');
    await page.getByPlaceholder('Search by name or phone...').fill(memberName);
    const row = page.locator('tr', { hasText: memberName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/pos\/members\/.+\/edit$/);
    stackingMemberId = page.url().split('/').slice(-2, -1)[0];
    expect(stackingMemberId).toBeTruthy();
  });

  test('a sale stacking member discount + voucher: applies both and checks out', async ({ request }) => {
    const item = await intakeItem({ name: `Seller Stacked Sale Item ${stamp}`, buyPrice: 80, sellPrice: 200 });
    const voucherCode = `STACK${stamp}`;

    // Vouchers are RoleRules.MANAGER_UP (branch-manager territory, see the persona skill) - a
    // CASHIER attempting POST /vouchers gets a 403, so this uses a separate, MANAGER-authenticated
    // `request` context (its own cookie jar, independent of the CASHIER `page` used throughout
    // this file) to set the voucher up, mirroring a manager configuring a promotion for staff to
    // apply at checkout.
    const managerLogin = await request.post('/api/v1/auth/login', {
      data: { email: 'manager@mulaerp.com', password: 'admin123' },
    });
    expect(managerLogin.ok(), `manager login failed: ${managerLogin.status()}`).toBeTruthy();
    const voucherRes = await request.post('/api/v1/vouchers', {
      data: { code: voucherCode, type: 'PERCENT', value: 10 },
    });
    expect(voucherRes.ok(), `voucher create failed: ${voucherRes.status()}`).toBeTruthy();

    await addToCart(item.name, item.sku);
    const baseSubtotal = 200;
    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(baseSubtotal));

    // Re-attach the now-SILVER member.
    await page.getByPlaceholder('Search member by name or phone...').fill(stackingMemberPhone);
    const memberOption = page.locator('button', { hasText: stackingMemberPhone });
    await expect(memberOption).toBeVisible({ timeout: 10000 });
    await memberOption.click();

    const memberCard = page.locator('p', { hasText: /tier ·/ });
    await expect(memberCard).toBeVisible({ timeout: 10000 });
    const memberCardText = (await memberCard.textContent()) ?? '';
    expect(memberCardText).toContain('SILVER');
    const percentMatch = memberCardText.match(/(\d+(?:\.\d+)?)%\s*discount applied/);
    const memberDiscountPercent = percentMatch ? parseFloat(percentMatch[1]) : 0;
    expect(memberDiscountPercent).toBe(5);
    const memberDiscountAmount = round2(baseSubtotal * (memberDiscountPercent / 100));
    await expect(valueAfterLabel(page, 'Member discount')).toHaveText(`-${formatMoney(memberDiscountAmount)}`);

    // Apply the voucher.
    await page.getByLabel('Voucher code').fill(voucherCode);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    const appliedLine = page.locator('p', { hasText: /^-RM\s[\d,.]+ applied$/ });
    await expect(appliedLine).toBeVisible({ timeout: 10000 });
    const appliedText = (await appliedLine.textContent()) ?? '';
    const voucherMatch = appliedText.match(/-RM\s([\d,.]+) applied/);
    const voucherDiscountAmount = voucherMatch ? parseFloat(voucherMatch[1].replace(/,/g, '')) : 0;
    expect(voucherDiscountAmount).toBeGreaterThan(0);

    const expectedTotal = round2(baseSubtotal - memberDiscountAmount - voucherDiscountAmount);
    await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(expectedTotal));

    await page.getByLabel('Payment method').selectOption('CASH');
    const tendered = round2(expectedTotal + 30);
    await page.getByLabel('Amount tendered').fill(tendered.toFixed(2));
    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(expectedTotal));
    await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(30));

    await startNewSale();
  });

  let creditMemberId: string;
  let creditMemberPhone: string;
  let creditMemberName: string;

  test('gives a member a store-credit balance via a trade-in payout, then redeems it on a sale', async () => {
    creditMemberName = `Credit Member ${stamp}`;
    creditMemberPhone = `018${`${stamp}`.slice(-8)}`;

    await page.goto('/pos');
    await page.getByRole('button', { name: 'Add Member' }).click();
    const memberModal = modalByTitle(page, 'Add Member');
    await memberModal.getByLabel('Name').fill(creditMemberName);
    await memberModal.getByLabel('Phone').fill(creditMemberPhone);
    await memberModal.getByRole('button', { name: 'Add Member' }).click();
    await expect(memberModal).toHaveCount(0);
    await expect(page.getByText(creditMemberName)).toBeVisible({ timeout: 10000 });

    // Pay this member RM50 store credit for a trade-in item (standalone payout, not part-exchange).
    await page.locator('#trade-in-description').fill(`Old Tablet ${stamp}`);
    await page.locator('#trade-in-credit-value').fill('50');
    await page.locator('#trade-in-payout-type').selectOption('STORE_CREDIT');
    await selectAnyTradeInCategory();
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.getByText(/paid out - RM\s?50\.00/)).toBeVisible({ timeout: 10000 });

    // The register updates the attached member's balance locally straight after the payout
    // (RegisterPage.tsx's handlePayoutTradeIn) - the redemption panel should now be visible
    // without needing to detach/reattach the member.
    await expect(page.getByText(`${creditMemberName} has ${formatMoney(50)} available.`)).toBeVisible({
      timeout: 10000,
    });

    // Now redeem it against a real sale.
    const item = await intakeItem({ name: `Seller Store Credit Item ${stamp}`, buyPrice: 40, sellPrice: 100 });
    await addToCart(item.name, item.sku);
    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(100));

    // page.goto() is a real browser navigation (not a client-side route push), so RegisterPage
    // remounts fresh and the member attached above is no longer in the cart - re-search and
    // re-attach by phone.
    if (!(await page.getByText(creditMemberName).isVisible().catch(() => false))) {
      await page.getByPlaceholder('Search member by name or phone...').fill(creditMemberPhone);
      const memberOption = page.locator('button', { hasText: creditMemberPhone });
      await expect(memberOption).toBeVisible({ timeout: 10000 });
      await memberOption.click();
    }

    await page.locator('#store-credit-redeem').fill('50');
    await expect(valueAfterLabel(page, 'Store credit redeemed')).toHaveText(`-${formatMoney(50)}`);
    await expect(valueAfterLabel(page, 'Total')).toHaveText(formatMoney(50));

    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill('50.00');
    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(50));

    await startNewSale();

    // Look up the member's id for the API balance check below and for the next test's reuse.
    await page.goto('/pos/members');
    await page.getByPlaceholder('Search by name or phone...').fill(creditMemberName);
    const row = page.locator('tr', { hasText: creditMemberName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/pos\/members\/.+\/edit$/);
    creditMemberId = page.url().split('/').slice(-2, -1)[0];

    const memberAfter = await apiGet(page, `/api/v1/members/${creditMemberId}`);
    expect(memberAfter.storeCreditBalance).toBe(0);
  });

  test('a trade-in paid in CASH', async () => {
    await page.goto('/pos');
    const description = `Old Radio ${stamp}`;
    await page.locator('#trade-in-description').fill(description);
    await page.locator('#trade-in-cash-value').fill('30');
    await page.locator('#trade-in-payout-type').selectOption('CASH');
    await selectAnyTradeInCategory();
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.getByText(/paid out - RM\s?30\.00/)).toBeVisible({ timeout: 10000 });

    // The trade-in receipt creates a brand-new, searchable product priced at the cash payout.
    const search = page.getByLabel('Search products');
    await search.fill(description);
    await expect(page.getByText(formatMoney(30))).toBeVisible({ timeout: 10000 });
  });

  test('a trade-in paid in STORE CREDIT (member balance rises)', async () => {
    await page.goto('/pos');
    await page.getByPlaceholder('Search member by name or phone...').fill(creditMemberPhone);
    const memberOption = page.locator('button', { hasText: creditMemberPhone });
    await expect(memberOption).toBeVisible({ timeout: 10000 });
    await memberOption.click();

    const before = await apiGet(page, `/api/v1/members/${creditMemberId}`);
    expect(before.storeCreditBalance).toBe(0);

    await page.locator('#trade-in-description').fill(`Old Camera ${stamp}`);
    await page.locator('#trade-in-credit-value').fill('75');
    await page.locator('#trade-in-payout-type').selectOption('STORE_CREDIT');
    await selectAnyTradeInCategory();
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.getByText(/paid out - RM\s?75\.00/)).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(`${creditMemberName} has ${formatMoney(75)} available.`)).toBeVisible({
      timeout: 10000,
    });

    const after = await apiGet(page, `/api/v1/members/${creditMemberId}`);
    expect(after.storeCreditBalance).toBe(75);
  });

  test('a part-exchange where the customer pays the balance', async () => {
    // intakeItem() below navigates to /pos/intake (a real browser navigation), which remounts
    // RegisterPage fresh - no member/cart state carries over from the previous test.
    const item = await intakeItem({ name: `Seller Part-Exchange Customer Pays ${stamp}`, buyPrice: 60, sellPrice: 150 });
    await addToCart(item.name, item.sku);
    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(150));

    await page.locator('#trade-in-description').fill(`Traded Console ${stamp}`);
    await page.locator('#trade-in-credit-value').fill('50');
    await selectAnyTradeInCategory();
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Trade-in added to sale')).toBeVisible({ timeout: 10000 });

    // 150 (sale) - 50 (trade-in) = 100 owed by the customer.
    await expect(valueAfterLabel(page, 'Trade-in applied')).toHaveText(`-${formatMoney(50)}`);
    await expect(page.locator(':text-is("Total") + *')).toHaveText(formatMoney(100));

    await page.getByLabel('Payment method').selectOption('CASH');
    await page.getByLabel('Amount tendered').fill('120.00');
    await expect(page.getByText(`Change: ${formatMoney(20)}`)).toBeVisible();

    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(valueAfterLabel(confirmation, 'Total')).toHaveText(formatMoney(100));
    await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(20));

    await startNewSale();
  });

  test('a part-exchange where the SHOP pays out (register shows cash owed to customer, not change)', async () => {
    const item = await intakeItem({ name: `Seller Part-Exchange Shop Pays ${stamp}`, buyPrice: 20, sellPrice: 50 });
    await addToCart(item.name, item.sku);
    await expect(valueAfterLabel(page, 'Subtotal')).toHaveText(formatMoney(50));

    await page.locator('#trade-in-description').fill(`Traded Laptop ${stamp}`);
    await page.locator('#trade-in-credit-value').fill('120');
    await selectAnyTradeInCategory();
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page.getByText('Trade-in added to sale')).toBeVisible({ timeout: 10000 });

    // 50 (sale) - 120 (trade-in) = -70: the shop owes the customer RM70, not the other way round.
    await expect(page.getByText('Cash owed to customer')).toBeVisible();
    await expect(page.locator(':text-is("Cash owed to customer") + *')).toHaveText(formatMoney(70));
    await expect(page.locator(':text-is("Total") + *')).toHaveCount(0);
    const warning = page.getByText(/hand the customer/i);
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('70.00');

    // amountDue is 0 (nothing owed by the customer), so no tendered-amount field renders even
    // with CASH selected.
    await page.getByLabel('Payment method').selectOption('CASH');
    await expect(page.getByLabel('Amount tendered')).toHaveCount(0);

    await page.getByRole('button', { name: 'Complete Sale' }).click();
    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    await expect(page.locator(':text-is("Cash owed to customer") + *').last()).toHaveText(formatMoney(70));
    await expect(valueAfterLabel(page, 'Change')).toHaveText(formatMoney(0));

    await startNewSale();
  });

  test('is blocked from oversight and financial reports', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Oversight' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);

    await page.goto('/oversight/money-flow');
    // .first(): React StrictMode double-invokes the mount-time fetch effect in dev, so a failed
    // fetch's error toast can render twice.
    await expect(page.getByText('You do not have permission to access this resource').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Takings by Payment Method')).not.toBeVisible();

    await page.goto('/accounting/profit-loss');
    await expect(page.getByText('Failed to fetch profit & loss report').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /^revenue$/i })).not.toBeVisible();
  });
});
