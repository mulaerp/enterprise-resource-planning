import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { createCustomerViaUi, createInvoiceViaUi, createPaymentForInvoiceViaUi } from '../helpers/ui-actions';

interface CsvRow {
  date: string;
  description: string;
  amount: string;
}

/**
 * Builds a tiny bank statement CSV in-memory (header: date,description,amount -
 * one of the two layouts BankStatementParser accepts) so tests stay hermetic
 * instead of depending on the checked-in sample file.
 */
function buildStatementCsv(rows: CsvRow[]): Buffer {
  const lines = ['date,description,amount', ...rows.map((r) => `${r.date},${r.description},${r.amount}`)];
  return Buffer.from(lines.join('\n'), 'utf-8');
}

async function uploadStatement(page: import('@playwright/test').Page, csv: Buffer, filename: string) {
  await page.getByLabel(/statement file/i).setInputFiles({ name: filename, mimeType: 'text/csv', buffer: csv });
  await page.getByRole('button', { name: /^import$/i }).click();
}

test.describe('Bank Reconciliation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/accounting/bank');
  });

  test('should import a generated CSV and show the imported count and rows', async ({ page }) => {
    const timestamp = Date.now();
    const day = new Date().toISOString().split('T')[0];
    const csv = buildStatementCsv([
      { date: day, description: `Test Deposit A ${timestamp}`, amount: '120.00' },
      { date: day, description: `Test Deposit B ${timestamp}`, amount: '75.50' },
      { date: day, description: `Test Withdrawal C ${timestamp}`, amount: '-30.00' },
    ]);

    await uploadStatement(page, csv, 'statement-3-rows.csv');

    // "Imported N" appears twice: the persistent summary paragraph ("Imported N,
    // skipped 0, duplicates 0") and the transient success toast ("Imported N
    // transaction(s)") - .first() just confirms one of them is showing.
    await expect(page.getByText(/imported 3/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Test Deposit A ${timestamp}`)).toBeVisible();
    await expect(page.getByText(`Test Deposit B ${timestamp}`)).toBeVisible();
    await expect(page.getByText(`Test Withdrawal C ${timestamp}`)).toBeVisible();
  });

  test('should flag duplicates when the same statement is re-imported', async ({ page }) => {
    const timestamp = Date.now();
    const day = new Date().toISOString().split('T')[0];
    const csv = buildStatementCsv([{ date: day, description: `Dup Test ${timestamp}`, amount: '42.00' }]);

    await uploadStatement(page, csv, 'dup-1.csv');
    await expect(page.getByText(/imported 1/i).first()).toBeVisible({ timeout: 10000 });

    await uploadStatement(page, csv, 'dup-2.csv');
    await expect(page.getByText(/duplicates 1/i)).toBeVisible({ timeout: 10000 });
  });

  test('should open and close the match suggestions modal for an unreconciled row', async ({ page }) => {
    const timestamp = Date.now();
    const day = new Date().toISOString().split('T')[0];
    const csv = buildStatementCsv([{ date: day, description: `Modal Test ${timestamp}`, amount: '17.25' }]);

    await uploadStatement(page, csv, 'modal-test.csv');
    await expect(page.getByText(/imported 1/i).first()).toBeVisible({ timeout: 10000 });

    const row = page.locator('table tbody tr', { hasText: `Modal Test ${timestamp}` });
    await row.getByRole('button', { name: /^match$/i }).click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal.getByRole('heading', { name: /match bank transaction/i })).toBeVisible();
    // No payment of this exact amount/date exists, so suggestions should come back empty -
    // that's still a clean pass: the modal opened and can be closed without error.
    await expect(modal.getByText(/no candidate payments found|loading suggestions/i)).toBeVisible({
      timeout: 10000,
    });

    await modal.getByRole('button', { name: /^close$/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('should suggest a matching payment and reconcile the row on Match', async ({ page }) => {
    const { name: customerName } = await createCustomerViaUi(page);
    await createInvoiceViaUi(page, customerName, { unitPrice: '500', quantity: '1' });
    // Payment amount auto-fills to the invoice's balanceDue (500.00), which is what
    // makes the exact-amount suggestion match below work.
    await createPaymentForInvoiceViaUi(page, customerName, { method: 'BANK_TRANSFER' });

    const timestamp = Date.now();
    const day = new Date().toISOString().split('T')[0];
    const csv = buildStatementCsv([{ date: day, description: `Matching Deposit ${timestamp}`, amount: '500.00' }]);

    await page.goto('/accounting/bank');
    await uploadStatement(page, csv, 'matching-deposit.csv');
    await expect(page.getByText(/imported 1/i).first()).toBeVisible({ timeout: 10000 });

    const row = page.locator('table tbody tr', { hasText: `Matching Deposit ${timestamp}` });
    await row.getByRole('button', { name: /^match$/i }).click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal.getByRole('heading', { name: /match bank transaction/i })).toBeVisible();

    const suggestionMatchButton = modal.getByRole('button', { name: /^match$/i }).first();
    await expect(suggestionMatchButton).toBeVisible({ timeout: 10000 });
    await suggestionMatchButton.click();

    await expect(page.getByText(/matched and reconciled/i)).toBeVisible({ timeout: 10000 });
    await expect(row.getByText(/^reconciled$/i)).toBeVisible();
  });
});
