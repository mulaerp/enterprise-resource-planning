import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { fieldByLabel, formatMoney, modalByTitle } from '../helpers/pos';

/**
 * Staff Repairs module - intake, lifecycle stepper, costs, cancellation, and
 * the list page's filters/search. Reads directly from:
 *  - src/pages/repair/RepairFormPage.tsx
 *  - src/pages/repair/RepairDetailPage.tsx
 *  - src/pages/repair/RepairListPage.tsx
 *  - src/lib/repair-status.ts (REPAIR_FLOW / status labels the UI advances through)
 *
 * REPAIR_FLOW is RECEIVED -> DIAGNOSED -> AWAITING_APPROVAL -> APPROVED ->
 * IN_REPAIR -> COMPLETED -> COLLECTED. The detail page's "Advance to X" button
 * always targets the single next step in that array, and each successful
 * advance shows a `Repair advanced to ${label}` toast - used below as the
 * status-changed assertion instead of parsing the badge's CSS classes.
 */
test.describe.serial('Repairs', () => {
  let page: Page;
  let walkInName: string;
  let walkInPhone: string;
  let jobNumber: string;
  let repairId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('creates a walk-in repair job and lands on its RECEIVED detail page', async () => {
    const stamp = Date.now();
    walkInName = `Repair Customer ${stamp}`;
    walkInPhone = `013${`${stamp}`.slice(-8)}`;

    await page.goto('/repairs/new');
    await expect(page.getByRole('heading', { name: 'New Repair Job' })).toBeVisible();

    // Walk-in is the default customer mode - no need to click its toggle.
    await fieldByLabel(page, 'Walk-in name').fill(walkInName);
    await fieldByLabel(page, 'Walk-in phone').fill(walkInPhone);
    await fieldByLabel(page, 'Device description').fill('iPhone 13 Pro, cracked screen');
    await fieldByLabel(page, 'Reported fault').fill('Screen unresponsive to touch after drop');

    await page.getByRole('button', { name: 'Create Repair Job' }).click();

    // Not a URL-pattern wait: "/repairs/new" itself matches `/\/repairs\/[^/]+$/`,
    // so a URL-only assertion can pass before the post-create navigate() actually
    // fires. Wait for the detail page's own heading instead - it only exists once
    // the app has genuinely navigated off the form.
    // level-1 heading is scoped by name - the staff Layout sidebar also renders
    // its own (unrelated) <h1>{branding.appName}</h1>.
    const heading = page.getByRole('heading', { level: 1, name: 'Repair' });
    await expect(heading).toContainText('Repair RJ-', { timeout: 10000 });
    repairId = page.url().split('/').pop()!;
    jobNumber = ((await heading.textContent()) ?? '').replace('Repair ', '').trim();
    expect(jobNumber).toBeTruthy();

    // RECEIVED is the first step - the only enabled advance target is Diagnosed.
    await expect(page.getByRole('button', { name: 'Advance to Diagnosed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Job' })).toBeVisible();
  });

  test('advances the job through the full stepper to COLLECTED', async () => {
    await page.goto(`/repairs/${repairId}`);

    // Collection now requires the balance to be paid, so give the job a cost first.
    await page.locator('#labour-cost').fill('50');
    await page.getByRole('button', { name: 'Save Details' }).click();
    await expect(page.getByText('Repair details saved')).toBeVisible({ timeout: 10000 });

    const steps = ['Diagnosed', 'Awaiting Approval', 'Approved', 'In Repair', 'Completed'];
    for (const label of steps) {
      await page.getByRole('button', { name: `Advance to ${label}` }).click();
      await expect(page.getByText(`Repair advanced to ${label}`)).toBeVisible({ timeout: 10000 });
    }

    // COLLECTED goes through Collect & Pay: the backend rejects collection while the
    // recorded payments don't cover totalCost.
    await page.getByRole('button', { name: 'Collect & Pay' }).click();
    await page.locator('#collect-amount').fill('50');
    await page.locator('#collect-method').selectOption('CASH');
    await page.getByRole('button', { name: 'Collect & Pay' }).last().click();
    await expect(page.getByText(/repair collected and paid/i)).toBeVisible({ timeout: 10000 });

    // COLLECTED is terminal: no further "Advance to" action and cancellation is closed off.
    await expect(page.getByRole('button', { name: /^Advance to/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel Job' })).toHaveCount(0);

    const headerBadge = page.locator('h1', { hasText: 'Repair' }).locator('xpath=following-sibling::span[1]');
    await expect(headerBadge).toHaveText('Collected');
  });

  test('setting parts/labour costs computes the total', async () => {
    await page.goto(`/repairs/${repairId}`);

    await page.locator('#parts-cost').fill('20');
    await page.locator('#labour-cost').fill('15');
    await page.getByRole('button', { name: 'Save Details' }).click();

    await expect(page.getByText('Repair details saved')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(':text-is("Total") + *')).toHaveText(formatMoney(35));
  });

  test('cancels a second repair job from RECEIVED', async () => {
    const stamp = Date.now();
    const secondName = `Repair Customer ${stamp}b`;

    await page.goto('/repairs/new');
    await fieldByLabel(page, 'Walk-in name').fill(secondName);
    await fieldByLabel(page, 'Walk-in phone').fill(`014${`${stamp}`.slice(-8)}`);
    await fieldByLabel(page, 'Device description').fill('Samsung Galaxy S23, battery drains fast');
    await fieldByLabel(page, 'Reported fault').fill('Battery drains from 100% to 0% in under 2 hours');
    await page.getByRole('button', { name: 'Create Repair Job' }).click();
    // See the comment above on the same "/repairs/new" URL-pattern trap -
    // wait for the detail page's "Cancel Job" trigger instead of the URL.
    const cancelTrigger = page.getByRole('button', { name: 'Cancel Job' });
    await expect(cancelTrigger).toBeVisible({ timeout: 10000 });
    await cancelTrigger.click();
    const modal = modalByTitle(page, 'Cancel Repair Job');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel Job' }).click();

    await expect(page.getByText('Repair job cancelled')).toBeVisible({ timeout: 10000 });
    const headerBadge = page.locator('h1', { hasText: 'Repair' }).locator('xpath=following-sibling::span[1]');
    await expect(headerBadge).toHaveText('Cancelled');
    // Cancelled hides the stepper entirely, so no advance/cancel actions remain.
    await expect(page.getByRole('button', { name: /^Advance to/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel Job' })).toHaveCount(0);
  });

  test('list page filter chips and search find the created job', async () => {
    await page.goto('/repairs');
    await expect(page.getByRole('heading', { name: 'Repairs', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Collected', exact: true }).click();
    await page.getByLabel('Search repairs').fill(walkInName);

    const row = page.locator('table tbody tr', { hasText: walkInName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(jobNumber);
    await expect(row).toContainText('Collected');
  });

  // V37: refunds on repair payments. Headline case from the task - a CASH deposit taken, then
  // the job is cancelled before any work is done, and the deposit is refunded back in full.
  // `login(page)` defaults to admin@mulaerp.com (ADMIN, which is in RoleRules.MANAGER_UP), so
  // this shared `page` can perform the refund - a CASHIER cannot (server-enforced 403; the
  // Refund action is hidden from a cashier's UI entirely, see RepairDetailPage.tsx's
  // REFUND_ROLES check).
  test('deposit + cancel + refund: a CASH deposit is fully refunded and clears net paid to zero', async () => {
    const stamp = Date.now();
    const refundWalkInName = `Repair Refund Customer ${stamp}`;

    await page.goto('/repairs/new');
    await fieldByLabel(page, 'Walk-in name').fill(refundWalkInName);
    await fieldByLabel(page, 'Walk-in phone').fill(`017${`${stamp}`.slice(-8)}`);
    await fieldByLabel(page, 'Device description').fill('Cassette deck, motor seized');
    await fieldByLabel(page, 'Reported fault').fill('Tape will not spin, motor makes a grinding noise');
    await page.getByRole('button', { name: 'Create Repair Job' }).click();

    const heading = page.getByRole('heading', { level: 1, name: 'Repair' });
    await expect(heading).toContainText('Repair RJ-', { timeout: 10000 });

    // Record a CASH deposit of RM50 (Type/Method default to Deposit/Cash).
    await page.locator('#payment-amount').fill('50');
    await page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(page.getByText('Payment recorded')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`${formatMoney(50)} of ${formatMoney(0)} paid (net)`)).toBeVisible();

    // Cancel the job - the headline case: a deposit taken, then the job never proceeds.
    await page.getByRole('button', { name: 'Cancel Job' }).click();
    const cancelModal = modalByTitle(page, 'Cancel Repair Job');
    await expect(cancelModal).toBeVisible();
    await cancelModal.getByRole('button', { name: 'Cancel Job' }).click();
    await expect(page.getByText('Repair job cancelled')).toBeVisible({ timeout: 10000 });

    // Refund the RM50 deposit in full - the Refund action (Undo2 icon, title="Refund") sits next
    // to the one payment row recorded above.
    await page.getByTitle('Refund').click();
    const refundModal = modalByTitle(page, 'Refund Payment');
    await expect(refundModal).toBeVisible();
    // Amount defaults to the refundable maximum (RM50) - confirm it, just add the required reason.
    await expect(refundModal.locator('#refund-amount')).toHaveValue('50.00');
    await refundModal.getByLabel(/reason/i).fill('Job cancelled after deposit taken - customer refunded in full');
    await refundModal.getByRole('button', { name: 'Refund' }).click();
    await expect(page.getByText('Refund recorded')).toBeVisible({ timeout: 10000 });

    // Net paid drops to zero, a REFUND-badged row appears, and the collected/refunded breakdown
    // is shown alongside it (RepairJobDto.totalPaid/totalRefunded/netPaid, V37).
    await expect(page.getByText(`${formatMoney(0)} of ${formatMoney(0)} paid (net)`)).toBeVisible();
    await expect(page.getByText(`${formatMoney(50)} collected − ${formatMoney(50)} refunded`)).toBeVisible();
    await expect(page.getByText('REFUND', { exact: true })).toBeVisible();
  });
});
