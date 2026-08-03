import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { fieldByLabel, modalByTitle, valueAfterLabel } from '../helpers/pos';

/**
 * Auto-post system journal entries - "books are live by default".
 *
 * mulaerp.accounting.auto-post-system-entries defaults true (AUTO_POST_SYSTEM_ENTRIES env var):
 * journal entries created by the SYSTEM auto-journal hooks (PoS sale/COGS, trade-in, invoice,
 * payment, repair) are POSTED immediately, in the same hook transaction that creates them
 * (AccountingService#createSystemEntry), instead of sitting as DRAFT until someone runs the bulk
 * post-batch endpoint. Manual entries (POST /accounting/journal-entries,
 * AccountingService#createJournalEntry) are unaffected and still require an explicit post -
 * see accounting.spec.ts's "should create a balanced journal entry" for that path.
 *
 * This spec proves the effect end to end: ring up a PoS sale as cashier, then read the P&L
 * report as accountant with zero manual posting steps in between, and confirm both that
 * (a) today's totalRevenue moved by exactly the sale amount and (b) the sale's own journal entry
 * is already POSTED (never DRAFT) via the API the report itself reads from.
 *
 * Two separate pages/browser contexts (one per role) rather than one shared page logging in
 * twice: `/login` is wrapped in `PublicOnlyRoute` (App.tsx), which immediately redirects an
 * already-authenticated session straight to /dashboard, so re-running the login helper on a page
 * that's already signed in as a different user never reaches the login form.
 *
 * NOTE: totalRevenue is a global, date-scoped aggregate across every journal entry in the system,
 * not scoped to this test's own data - test.describe.serial keeps the three steps below in order
 * on one worker so nothing else runs between the baseline read and the post-sale read. Running
 * this file concurrently with other specs that also post dated-today PoS/invoice/payment/repair
 * activity would make the "moved by exactly this amount" assertion flaky, same as any test built
 * on a global report total rather than a freshly-scoped record.
 */
test.describe.serial('Auto-post system journal entries', () => {
  let accountantPage: Page;
  let cashierPage: Page;
  let itemName: string;
  let itemSku: string;
  let saleNumber: string;
  const sellPrice = '137.13';
  let baselineTotalRevenue = 0;

  const today = () => new Date().toISOString().split('T')[0];

  const loadTodaysProfitLoss = async (): Promise<{ totalRevenue: number; draftEntriesInPeriod: number }> => {
    await accountantPage.goto('/accounting/profit-loss');
    await accountantPage.getByLabel('Start Date').fill(today());
    await accountantPage.getByLabel('End Date').fill(today());
    const [response] = await Promise.all([
      accountantPage.waitForResponse(
        (resp) => resp.url().includes('/accounting/reports/profit-loss') && resp.request().method() === 'GET'
      ),
      accountantPage.getByRole('button', { name: /generate/i }).click(),
    ]);
    return response.json();
  };

  test.beforeAll(async ({ browser }) => {
    accountantPage = await browser.newPage();
    cashierPage = await browser.newPage();
    await login(accountantPage, 'accountant@mulaerp.com');
    await login(cashierPage, 'cashier@mulaerp.com');
  });

  test.afterAll(async () => {
    await accountantPage.close();
    await cashierPage.close();
  });

  test('records today\'s P&L revenue baseline as accountant, before any new sale', async () => {
    const report = await loadTodaysProfitLoss();
    baselineTotalRevenue = report.totalRevenue;
    expect(baselineTotalRevenue).toBeGreaterThanOrEqual(0);
  });

  test('cashier rings up a new item for cash - no posting step exists in this flow', async () => {
    const stamp = Date.now();
    itemName = `Auto-Post Verify ${stamp}`;
    const page = cashierPage;

    await page.goto('/pos/intake');
    await expect(page.getByRole('heading', { name: 'Item Intake' })).toBeVisible();
    itemSku = await fieldByLabel(page, 'SKU').inputValue();
    expect(itemSku).toBeTruthy();

    await fieldByLabel(page, 'Item Name').fill(itemName);
    await fieldByLabel(page, 'Condition').selectOption('GOOD');
    await fieldByLabel(page, 'Buy Price').fill('50');
    await fieldByLabel(page, 'Sell Price').fill(sellPrice);
    await fieldByLabel(page, 'Quantity').fill('1');
    await page.getByRole('button', { name: 'Save Item' }).click();
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/pos');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    await expect(page.getByText(itemSku)).toBeVisible();
    await search.press('Enter');
    await expect(page.getByText('No items yet.')).not.toBeVisible();

    // Payment method defaults to CASH; tender the exact amount so change = 0 and the sale total
    // is precisely sellPrice, with no discounts/member/voucher/trade-in involved.
    await page.getByLabel('Amount tendered').fill(sellPrice);
    await page.getByRole('button', { name: 'Complete Sale' }).click();

    const confirmation = modalByTitle(page, 'Sale Complete');
    await expect(confirmation).toBeVisible({ timeout: 10000 });
    saleNumber = (await valueAfterLabel(confirmation, 'Sale number').textContent())?.trim() ?? '';
    expect(saleNumber.length).toBeGreaterThan(0);
  });

  test('P&L revenue moves by exactly the sale amount, and the sale\'s journal entry is already POSTED', async () => {
    const report = await loadTodaysProfitLoss();
    const revenueDelta = Number((report.totalRevenue - baselineTotalRevenue).toFixed(2));
    expect(revenueDelta).toBe(Number(sellPrice));

    // Confirm directly against the API the report itself reads from: the sale's own revenue
    // journal entry must be POSTED, never DRAFT - no PostDraftsPage / post-batch visit happened
    // anywhere in this test.
    const entriesResponse = await accountantPage.request.get('/api/v1/accounting/journal-entries');
    expect(entriesResponse.ok()).toBeTruthy();
    const entries: Array<{ reference?: string; status: string }> = await entriesResponse.json();
    const saleEntries = entries.filter((e) => e.reference === saleNumber);
    expect(saleEntries.length).toBeGreaterThan(0);
    for (const entry of saleEntries) {
      expect(entry.status).toBe('POSTED');
    }
  });
});
