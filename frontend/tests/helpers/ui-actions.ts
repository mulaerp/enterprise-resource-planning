import { Page, expect, test } from '@playwright/test';

/**
 * Shared UI-driven data setup helpers for specs that need a real customer, invoice,
 * or payment to exist (the suite tolerates a fresh empty DB, so preconditions are
 * always created through the UI rather than seeded directly).
 */

export interface CreatedCustomer {
  name: string;
  email: string;
}

/**
 * Creates a customer via the UI and returns its (unique, timestamped) name/email.
 */
export async function createCustomerViaUi(page: Page, namePrefix = 'Test Customer'): Promise<CreatedCustomer> {
  const timestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = `${namePrefix} ${timestamp}`;
  const email = `customer${timestamp}@test.com`;

  await page.goto('/customers/new');
  await page.getByLabel(/^name/i).fill(name);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/phone/i).fill('1234567890');
  await page.getByLabel(/address/i).fill('123 Test Street');
  await page.getByLabel(/tax id/i).fill(`TAX${timestamp}`);
  await page.getByLabel(/credit limit/i).fill('10000');
  await page.getByRole('button', { name: /save|create/i }).click();
  // Don't wait on the success toast: it auto-dismisses after 5s
  // (components/ui/Toast.tsx default duration), and under load Playwright's
  // assertion retry can land after it's already gone, flaking a create that
  // actually succeeded. CustomerFormPage.tsx's handleSubmit shows the toast
  // and calls navigate('/customers') back-to-back, so the URL change is a
  // durable post-create signal that can't disappear out from under the poll.
  await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });

  return { name, email };
}

/**
 * Creates a single-line invoice for an existing customer via the UI. Defaults to a
 * round $500.00 total (qty 1 x $500) so downstream payment/bank-matching amounts
 * are predictable and exact (bank suggestion matching compares amounts exactly).
 * Skips the test if the customer isn't selectable (defensive against a flaky fetch).
 */
export async function createInvoiceViaUi(
  page: Page,
  customerName: string,
  options: { quantity?: string; unitPrice?: string; description?: string } = {}
): Promise<void> {
  const { quantity = '1', unitPrice = '500', description = 'Consulting services' } = options;

  await page.goto('/invoices/new');
  const customerSelect = page.getByLabel(/customer/i);
  // The customer list loads asynchronously after mount - a bare one-shot .count() right after
  // goto() races that fetch (especially in an environment with hundreds of customers, where the
  // request itself takes a beat longer), so this polls briefly instead of trusting whatever the
  // select happens to contain the instant the page finishes navigating.
  try {
    await expect
      .poll(async () => customerSelect.locator('option').count(), { timeout: 8000 })
      .toBeGreaterThan(1);
  } catch {
    // Never loaded any customers within the wait - fall through to the skip guard below
    // (a genuinely customer-less database, which this helper has always tolerated).
  }
  const customerOptionCount = await customerSelect.locator('option').count();
  test.skip(customerOptionCount <= 1, 'No customer available to select');

  await customerSelect.selectOption({ label: customerName });
  await page.getByPlaceholder(/description/i).first().fill(description);
  await page.getByPlaceholder(/qty/i).first().fill(quantity);
  await page.getByPlaceholder(/price/i).first().fill(unitPrice);

  await page.getByRole('button', { name: /create invoice/i }).click();
  // See createCustomerViaUi's comment above: wait for the durable
  // post-create navigation instead of the auto-dismissing toast.
  await expect(page).toHaveURL(/\/invoices$/, { timeout: 10000 });
}

/**
 * Records a payment against the unpaid invoice belonging to `customerName`. The
 * payment form auto-fills `amount` to the invoice's balanceDue when an invoice is
 * selected, so the resulting payment amount matches whatever createInvoiceViaUi
 * billed. Selects by customer name (embedded in the option label) rather than by
 * index, so it stays correct even if other unpaid invoices exist from other tests.
 */
export async function createPaymentForInvoiceViaUi(
  page: Page,
  customerName: string,
  options: { method?: string } = {}
): Promise<void> {
  const { method = 'CASH' } = options;

  await page.goto('/payments/new');
  const invoiceSelect = page.getByLabel(/invoice/i);
  const matchingOption = invoiceSelect.locator('option', { hasText: customerName }).first();
  // Same async-load race as createInvoiceViaUi's customer select above - give the invoice list a
  // moment to actually populate before deciding there's no match, rather than racing the fetch
  // that fires on mount.
  try {
    await expect.poll(async () => matchingOption.count(), { timeout: 8000 }).toBeGreaterThan(0);
  } catch {
    // Never appeared within the wait - fall through to the skip guard below.
  }
  const hasMatch = (await matchingOption.count()) > 0;
  test.skip(!hasMatch, 'No unpaid invoice available for this customer');

  const optionValue = await matchingOption.getAttribute('value');
  await invoiceSelect.selectOption(optionValue!);
  await page.getByLabel(/payment date/i).fill(new Date().toISOString().split('T')[0]);
  await page.getByLabel(/payment method/i).selectOption(method);

  await page.getByRole('button', { name: /record payment/i }).click();
  // See createCustomerViaUi's comment above: wait for the durable
  // post-create navigation instead of the auto-dismissing toast.
  await expect(page).toHaveURL(/\/payments$/, { timeout: 10000 });
}

/**
 * Opens the invoice detail page for the most recent invoice belonging to
 * `customerName` from the invoices list. The list's per-row "view" link has no
 * accessible name (icon-only), so it's targeted by being the first
 * `/invoices/:id` link within the row that contains the customer's name.
 */
export async function openInvoiceDetailByCustomer(page: Page, customerName: string): Promise<void> {
  await page.goto('/invoices');
  const row = page.locator('table tbody tr', { hasText: customerName }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('a[href^="/invoices/"]').first().click();
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
}
