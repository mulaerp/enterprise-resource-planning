import { test, expect, type Page } from '@playwright/test';
import { login } from '../../helpers/auth';
import { createCustomerViaUi, createInvoiceViaUi } from '../../helpers/ui-actions';
import { createProductViaApi } from '../../helpers/api-setup';

/**
 * Persona 3 - Accountant (ACCOUNTANT role).
 *
 * Owns the books end-to-end: drafts preview + batch posting, financial statements + exports, and
 * is deliberately withheld from warehouse CRUD and user management (see RoleRules.STOCK_WRITERS /
 * RoleRules.ADMIN_ONLY).
 *
 * Reads directly from:
 *  - src/pages/accounting/{PostDraftsPage,ProfitLossPage,BalanceSheetPage,TrialBalancePage}.tsx
 *  - backend AccountingService#getDraftsPreview/postBatch (groups drafts by source - "PoS Sale",
 *    "Invoice", "Payment", "Manual"; posting is all-or-nothing)
 *  - backend PosSaleService/InvoiceService/PaymentService (each fires its own non-blocking
 *    auto-journal via AccountingService#createSystemEntry - see the `accounting` skill).
 *    mulaerp.accounting.auto-post-system-entries defaults true, so these SYSTEM entries are
 *    POSTED immediately and never reach the drafts queue; AccountingService#createJournalEntry
 *    (the manual entry endpoint, used below) is the only path that still lands as DRAFT, which is
 *    what the drafts-preview/post-batch workflow exercises here.
 *
 * Two pages are used: `setupPage` (ADMIN) only to create the customer/product this spec's
 * transactions need (customer/member CREATE and product CREATE both sit outside
 * RoleRules.ACCOUNTANT_WRITERS) - every accounting action itself (invoice, payment, PoS sale,
 * manual journal entry, drafts preview/post, statements, exports) runs on `page` as the
 * ACCOUNTANT persona.
 */
test.describe.serial('Persona: Accountant (ACCOUNTANT)', () => {
  let page: Page;
  let setupPage: Page;
  const stamp = Date.now();
  const saleAmount = 300;
  const saleCost = 100;
  const invoiceAmount = 1000;

  test.beforeAll(async ({ browser }) => {
    setupPage = await browser.newPage();
    await login(setupPage, 'admin@mulaerp.com', 'admin123');
    page = await browser.newPage();
    await login(page, 'accountant@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await setupPage.close();
    await page.close();
  });

  test('a PoS sale (revenue + COGS), an invoice + full payment, and one manual draft entry', async () => {
    // Product CREATE sits outside ACCOUNTANT_WRITERS - created via the ADMIN setup page. The sale
    // itself has no role restriction (PosSaleController carries no @PreAuthorize at all), so it's
    // fired from the accountant's own authenticated session below.
    const product = await createProductViaApi(setupPage, {
      sku: `ACCT-${stamp}`,
      name: `Accountant Persona Item ${stamp}`,
      unitPrice: saleAmount,
      costPrice: saleCost,
      acquisitionCost: saleCost,
      stockQuantity: 1,
      reorderLevel: 0,
      status: 'ACTIVE',
    });

    const saleRes = await page.request.post('/api/v1/pos/sales', {
      data: {
        clientSaleId: `accountant-spec-sale-${stamp}`,
        paymentMethod: 'CASH',
        amountTendered: saleAmount,
        lines: [{ productId: product.id, quantity: 1, unitPrice: saleAmount }],
      },
    });
    expect(saleRes.ok(), `PoS sale failed: ${saleRes.status()}`).toBeTruthy();

    const { name: customerName } = await createCustomerViaUi(setupPage, 'Accountant Persona Customer');
    await createInvoiceViaUi(page, customerName, { unitPrice: String(invoiceAmount), quantity: '1' });

    // Full payment via a direct API call rather than the payment form's own invoice-select
    // dropdown (createPaymentForInvoiceViaUi) - that dropdown lists every unpaid invoice with no
    // search/filter, and in a long-lived, heavily-exercised environment like this one it can take
    // a beat to include one just created a moment ago; the payment FORM itself is already covered
    // by payments.spec.ts, so this persona's own scenario doesn't need to re-drive it.
    const invoicesRes = await page.request.get('/api/v1/invoices?size=200&sort=invoiceDate,desc');
    expect(invoicesRes.ok()).toBeTruthy();
    const { content: invoices } = await invoicesRes.json();
    const invoice = invoices.find((inv: { customerName: string }) => inv.customerName === customerName);
    expect(invoice, 'the just-created invoice should be findable via the API').toBeTruthy();

    const paymentRes = await page.request.post('/api/v1/payments', {
      data: {
        invoiceId: invoice.id,
        paymentDate: new Date().toISOString().split('T')[0],
        amount: invoice.balanceDue,
        method: 'CASH',
      },
    });
    expect(paymentRes.ok(), `payment create failed: ${paymentRes.status()}`).toBeTruthy();

    // The three transactions above all auto-post immediately (SYSTEM entries, see the file-level
    // doc comment) - none of them leave anything in the drafts queue. A manually-created journal
    // entry (AccountingService#createJournalEntry) is the only path that still lands as DRAFT, so
    // create one here to give the drafts-preview/post-batch workflow below something real to find
    // and post - the accountant persona's other legitimate route to the same screen (hand-written
    // adjustments still require an explicit human review/post step by design).
    const accountsRes = await page.request.get('/api/v1/accounting/accounts');
    expect(accountsRes.ok()).toBeTruthy();
    const accounts: Array<{ id: string; code: string }> = await accountsRes.json();
    const cash = accounts.find((a) => a.code === '1110');
    const salesRevenue = accounts.find((a) => a.code === '4100');
    expect(cash, 'Cash and Cash Equivalents (1110) should exist').toBeTruthy();
    expect(salesRevenue, 'Sales Revenue (4100) should exist').toBeTruthy();

    const manualEntryRes = await page.request.post('/api/v1/accounting/journal-entries', {
      data: {
        entryDate: new Date().toISOString().split('T')[0],
        description: `Accountant persona manual draft ${stamp}`,
        reference: `ACCT-MANUAL-${stamp}`,
        lines: [
          { accountId: cash!.id, debit: 1, credit: 0 },
          { accountId: salesRevenue!.id, debit: 0, credit: 1 },
        ],
      },
    });
    expect(manualEntryRes.ok(), `manual journal entry create failed: ${manualEntryRes.status()}`).toBeTruthy();
    const manualEntry = await manualEntryRes.json();
    expect(manualEntry.status).toBe('DRAFT');
  });

  test('opens the drafts preview for today and finds the unposted manual entry', async () => {
    await page.goto('/accounting/journal-entries/post-drafts');
    await expect(page.getByRole('heading', { name: 'Post Drafts' })).toBeVisible();

    // The default range (1 Jan this year -> today) already covers "today" - Generate isn't
    // strictly required (loadPreview runs on mount) but re-running it is a harmless, realistic
    // action for the persona to take.
    await page.getByRole('button', { name: 'Preview' }).click();

    const selectAllLabel = page.getByText(/^Select all \(\d+ drafts?\)$/);
    await expect(selectAllLabel).toBeVisible({ timeout: 10000 });
    const labelText = (await selectAllLabel.textContent()) ?? '';
    const draftCount = parseInt(labelText.match(/\((\d+)/)?.[1] ?? '0', 10);
    expect(draftCount).toBeGreaterThan(0);

    // The PoS sale/invoice/payment above all auto-posted immediately (see the previous test) -
    // the manual entry created there is grouped under "Manual" (AccountingService#deriveSource),
    // the only source this drafts queue can still contain for freshly-created activity.
    await expect(page.getByText(/^Manual \(\d+\)$/)).toBeVisible();
  });

  test('posts the batch', async () => {
    await page.goto('/accounting/journal-entries/post-drafts');
    await expect(page.getByText(/^Select all \(\d+ drafts?\)$/)).toBeVisible({ timeout: 10000 });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /^Post Selected/ }).click();

    // .first(): the same text briefly appears twice - the persistent confirmation Card and the
    // (auto-dismissing) success toast.
    const postedLine = page.getByText(/^Posted \d+ journal entr(y|ies)$/).first();
    await expect(postedLine).toBeVisible({ timeout: 15000 });
    // Batch posting is all-or-nothing and balanced by construction (AccountingService#postBatch) -
    // the confirmation line reports the same figure on both sides. Located as the sibling
    // paragraph right after the one just confirmed above, rather than matching its own full text
    // via a regex (formatMoney's amounts get large across repeated runs against this shared DB).
    const totalsLine = postedLine.locator('xpath=following-sibling::p[1]');
    await expect(totalsLine).toBeVisible({ timeout: 10000 });
    const totalsText = (await totalsLine.textContent()) ?? '';
    const [debitsText, creditsText] = totalsText.split('=');
    expect(debitsText.replace(/[^0-9.]/g, '')).toBe(creditsText.replace(/[^0-9.]/g, ''));
  });

  test('P&L shows non-zero revenue and COGS after posting', async () => {
    await page.goto('/accounting/profit-loss');
    await page.getByRole('button', { name: /^generate$/i }).click();
    await expect(page.getByRole('heading', { name: /^revenue$/i })).toBeVisible({ timeout: 10000 });

    const totalRevenueRow = page.locator('tr', { hasText: 'Total Revenue' });
    const totalRevenueText = (await totalRevenueRow.textContent()) ?? '';
    const revenueValue = parseFloat(totalRevenueText.replace(/[^0-9.]/g, ''));
    expect(revenueValue).toBeGreaterThan(0);

    const cogsRow = page.locator('tr', { hasText: /5100|COGS/i }).first();
    await expect(cogsRow).toBeVisible({ timeout: 10000 });
    const totalExpensesRow = page.locator('tr', { hasText: 'Total Expenses' });
    const totalExpensesText = (await totalExpensesRow.textContent()) ?? '';
    const expensesValue = parseFloat(totalExpensesText.replace(/[^0-9.]/g, ''));
    expect(expensesValue).toBeGreaterThan(0);
  });

  test('balance sheet balances (assets = liabilities + equity within a cent)', async () => {
    await page.goto('/accounting/balance-sheet');
    await page.getByRole('button', { name: /^generate$/i }).click();
    await expect(page.getByRole('heading', { name: /^assets$/i })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Assets = Liabilities + Equity')).toBeVisible();
    await expect(page.getByText(/out of balance by/i)).not.toBeVisible();
  });

  test('trial balance debits equal credits', async () => {
    await page.goto('/accounting/trial-balance');
    await expect(page.getByRole('heading', { name: 'Trial Balance' })).toBeVisible();
    await expect(page.getByText('Trial Balance is balanced')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Trial Balance is out of balance!')).not.toBeVisible();

    const footerRow = page.locator('tfoot tr');
    const debitCell = footerRow.locator('td').nth(1);
    const creditCell = footerRow.locator('td').nth(2);
    expect((await debitCell.textContent())?.trim()).toBe((await creditCell.textContent())?.trim());
  });

  test('downloads the P&L report as PDF and CSV', async () => {
    await page.goto('/accounting/profit-loss');
    await page.getByRole('button', { name: /^generate$/i }).click();
    await expect(page.getByRole('heading', { name: /^revenue$/i })).toBeVisible({ timeout: 10000 });

    const pdfDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.getByRole('button', { name: /export pdf/i }).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);

    const csvDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.getByRole('button', { name: /export csv/i }).click();
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('is blocked from creating a warehouse and from user management', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);

    await page.goto('/inventory/warehouses/new');
    await page.getByLabel(/code/i).fill(`ACCTBLK${stamp}`.slice(0, 20));
    await page.getByLabel(/^name/i).fill(`Accountant Blocked Warehouse ${stamp}`);
    await page.getByRole('button', { name: /create warehouse/i }).click();
    await expect(page.getByText('You do not have permission to access this resource')).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/inventory\/warehouses\/new$/);

    await page.goto('/users');
    // .first(): React StrictMode double-invokes the fetch effect in dev, firing the toast twice.
    await expect(page.getByText('Failed to fetch users').first()).toBeVisible({ timeout: 10000 });
    // DataTable always renders one row for its own empty state ("No data available") rather than
    // zero rows - confirm that placeholder, not an actual user record.
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.getByText('No data available')).toBeVisible();
  });
});
