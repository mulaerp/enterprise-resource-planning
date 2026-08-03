import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { createCustomerViaUi, createInvoiceViaUi, openInvoiceDetailByCustomer } from '../helpers/ui-actions';
import { formatMoney } from '../helpers/pos';

const firstDayOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

test.describe('Reports and exports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Financial Report card on the Reports hub navigates to Profit & Loss', async ({ page }) => {
    await page.goto('/reports');
    await page.getByText(/financial report/i).click();
    await expect(page).toHaveURL(/\/accounting\/profit-loss/);
  });

  test.describe('Profit & Loss', () => {
    test('should generate a report for the current month with revenue from an invoice', async ({ page }) => {
      const { name: customerName } = await createCustomerViaUi(page);
      await createInvoiceViaUi(page, customerName, { unitPrice: '500', quantity: '1' });

      // FinancialStatementService builds P&L strictly from POSTED journal entries (drafts are
      // deliberately excluded - see its own Javadoc). mulaerp.accounting.auto-post-system-entries
      // defaults true, so the invoice's auto-generated journal entry above
      // (AccountingService#createSystemEntry, invoked from InvoiceService's journal hook) is
      // already POSTED by the time this line runs - no manual post-batch step is needed (nor
      // expected to find anything DRAFT left to post) before it shows up here.
      await page.goto('/accounting/profit-loss');
      await page.getByLabel(/start date/i).fill(firstDayOfMonth());
      await page.getByLabel(/end date/i).fill(today());
      await page.getByRole('button', { name: /^generate$/i }).click();

      await expect(page.getByRole('heading', { name: /^revenue$/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: /^expenses$/i })).toBeVisible();
      await expect(page.getByText(/net income/i)).toBeVisible();
      // Not an exact "RM 500.00" text match: the P&L shows each account's running total for the
      // whole period, and this environment isn't reset between runs, so Sales Revenue can
      // legitimately already carry other posted activity from earlier in the same day - this
      // invoice's RM500 is additive to that, not the account's sole content. Read the actual
      // Total Revenue figure and confirm it's at least the RM500 this test just posted.
      const totalRevenueRow = page.locator('tr', { hasText: 'Total Revenue' });
      const totalRevenueText = (await totalRevenueRow.textContent()) ?? '';
      const revenueValue = parseFloat(totalRevenueText.replace(/[^0-9.]/g, ''));
      expect(revenueValue).toBeGreaterThanOrEqual(500);
    });
  });

  test.describe('Balance Sheet', () => {
    test('should generate a report as of today with sections and the balance check', async ({ page }) => {
      const { name: customerName } = await createCustomerViaUi(page);
      await createInvoiceViaUi(page, customerName, { unitPrice: '250', quantity: '2' });

      await page.goto('/accounting/balance-sheet');
      await page.getByLabel(/as of date/i).fill(today());
      await page.getByRole('button', { name: /^generate$/i }).click();

      await expect(page.getByRole('heading', { name: /^assets$/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: /^liabilities$/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /^equity$/i })).toBeVisible();
      await expect(page.getByText(/assets = liabilities \+ equity/i)).toBeVisible();
    });
  });

  test.describe('Exports', () => {
    test('should export the Profit & Loss report as PDF and CSV', async ({ page }) => {
      const { name: customerName } = await createCustomerViaUi(page);
      await createInvoiceViaUi(page, customerName, { unitPrice: '300', quantity: '1' });

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

    test('should export the Balance Sheet as PDF and CSV', async ({ page }) => {
      const { name: customerName } = await createCustomerViaUi(page);
      await createInvoiceViaUi(page, customerName, { unitPrice: '300', quantity: '1' });

      await page.goto('/accounting/balance-sheet');
      await page.getByRole('button', { name: /^generate$/i }).click();
      await expect(page.getByRole('heading', { name: /^assets$/i })).toBeVisible({ timeout: 10000 });

      const pdfDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.getByRole('button', { name: /export pdf/i }).click();
      const pdfDownload = await pdfDownloadPromise;
      expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);

      const csvDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.getByRole('button', { name: /export csv/i }).click();
      const csvDownload = await csvDownloadPromise;
      expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/i);
    });

    test('should export the Sales report as PDF', async ({ page }) => {
      await page.goto('/reports/sales');

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.getByRole('button', { name: /export pdf/i }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });

    test('should export the Inventory report as PDF', async ({ page }) => {
      await page.goto('/reports/inventory');

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.getByRole('button', { name: /export pdf/i }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });

    test('should download an invoice as PDF from its detail page', async ({ page }) => {
      const { name: customerName } = await createCustomerViaUi(page);
      await createInvoiceViaUi(page, customerName, { unitPrice: '150', quantity: '1' });
      await openInvoiceDetailByCustomer(page, customerName);

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.getByRole('button', { name: /download pdf/i }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    });
  });
});
