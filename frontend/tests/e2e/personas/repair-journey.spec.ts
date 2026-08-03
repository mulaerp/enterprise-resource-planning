import { test, expect, type Page } from '@playwright/test';
import { login } from '../../helpers/auth';
import { fieldByLabel, formatMoney, modalByTitle } from '../../helpers/pos';

/**
 * Persona 3 - the HDMI-port repair journey (INVENTORY creates the part, CASHIER runs the whole
 * repair lifecycle, then an anonymous/public check confirms the customer-facing status).
 *
 * Reads directly from:
 *  - src/pages/repair/{RepairFormPage,RepairDetailPage}.tsx
 *  - src/lib/repair-status.ts (REPAIR_FLOW)
 *  - backend RepairJobService (PARTS_EDITABLE_STATUSES, guardFullyPaidUnlessWarrantyClaim,
 *    consumePartsForRepair - parts are only actually decremented from stock at the IN_REPAIR
 *    transition, and COLLECTED is refused (409) until payments cover totalCost)
 *  - backend PublicRepairController (anonymous permitAll status lookup by job number)
 *
 * Money: part cost RM40 + labour RM120 = RM160 total, matching the personas skill's worked-figures
 * convention for a repair.
 */
test.describe.serial('Persona: Repair journey (INVENTORY + CASHIER)', () => {
  let inventoryPage: Page;
  let cashierPage: Page;
  const stamp = Date.now();
  const partSku = `PART-${stamp}`;
  const partName = `HDMI Port Flex Cable ${stamp}`;
  let jobNumber: string;
  let repairId: string;
  let deviceProductId: string;

  test.beforeAll(async ({ browser }) => {
    inventoryPage = await browser.newPage();
    await login(inventoryPage, 'inventory@mulaerp.com', 'admin123');
    cashierPage = await browser.newPage();
    await login(cashierPage, 'cashier@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await inventoryPage.close();
    await cashierPage.close();
  });

  test('INVENTORY creates a part product (cost RM40, stock 2)', async () => {
    await inventoryPage.goto('/products/new');
    await expect(inventoryPage.getByRole('heading', { name: 'Add New Product' })).toBeVisible();
    await inventoryPage.getByLabel(/sku/i).fill(partSku);
    await inventoryPage.getByLabel(/^name/i).fill(partName);
    await inventoryPage.getByLabel(/unit price/i).fill('40');
    await inventoryPage.getByLabel(/cost price/i).fill('40');
    await inventoryPage.getByLabel(/stock quantity/i).fill('2');
    await inventoryPage.getByLabel(/reorder level/i).fill('0');
    await inventoryPage.getByRole('button', { name: /save|create/i }).click();
    await expect(inventoryPage.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // A second, minimal catalog entry representing the device itself (a "PS5 Console" line) -
    // the next test links the repair job to it via RepairFormPage's "Device (from catalogue)"
    // picker, which is what makes the workmanship warranty issuable at collection.
    const deviceRes = await inventoryPage.request.post('/api/v1/products', {
      data: {
        sku: `DEVICE-${stamp}`,
        name: `PS5 Console (repair intake) ${stamp}`,
        unitPrice: 0,
        costPrice: 0,
        stockQuantity: 0,
        reorderLevel: 0,
        status: 'ACTIVE',
      },
    });
    expect(deviceRes.ok(), `device product create failed: ${deviceRes.status()}`).toBeTruthy();
    deviceProductId = (await deviceRes.json()).id;
  });

  test('CASHIER books a walk-in repair (PS5, no HDMI output) and links it to the catalogue device', async () => {
    // RepairFormPage.tsx's "Device (from catalogue)" picker (optional, debounced /products search
    // exactly like RegisterPage's/parts-picker's search-as-you-type pattern) is what lets this job
    // carry a productId - and WarrantyService#issueWorkmanshipWarranty is gated on productId !=
    // null, so linking here is what makes the workmanship warranty issuable at collection below.
    // Booked entirely through the UI now (no direct API workaround) - walk-in name/phone/device
    // description/reported fault are otherwise unchanged from RepairFormPage.tsx's plain fields.
    await cashierPage.goto('/repairs/new');
    await expect(cashierPage.getByRole('heading', { name: 'New Repair Job' })).toBeVisible();

    await fieldByLabel(cashierPage, 'Walk-in name').fill(`Repair Journey Customer ${stamp}`);
    await fieldByLabel(cashierPage, 'Walk-in phone').fill(`015${`${stamp}`.slice(-8)}`);

    await cashierPage.locator('#repair-product-search').fill(`DEVICE-${stamp}`);
    const productOption = cashierPage.locator('button', { hasText: `DEVICE-${stamp}` });
    await expect(productOption).toBeVisible({ timeout: 10000 });
    await productOption.click();

    await fieldByLabel(cashierPage, 'Device description').fill('PS5, no HDMI output');
    await fieldByLabel(cashierPage, 'Reported fault').fill(
      'Console powers on but there is no video output over HDMI'
    );
    await cashierPage.getByRole('button', { name: 'Create Repair Job' }).click();

    // Not a URL-pattern wait, same trap as repairs.spec.ts - wait for the detail page's own
    // heading instead of the URL.
    const heading = cashierPage.getByRole('heading', { level: 1, name: 'Repair' });
    await expect(heading).toContainText('Repair RJ-', { timeout: 10000 });
    repairId = cashierPage.url().split('/').pop()!;
    jobNumber = ((await heading.textContent()) ?? '').replace('Repair ', '').trim();
    expect(jobNumber).toBeTruthy();

    // Confirms the link actually took - the Job Details panel shows the catalogue product (name +
    // SKU) as a link to its product page, pointing at the exact product created above, instead of
    // "Walk-in device (not in catalogue)".
    const productLink = cashierPage.getByRole('link', { name: new RegExp(`PS5 Console \\(repair intake\\) ${stamp}`) });
    await expect(productLink).toBeVisible({ timeout: 10000 });
    await expect(productLink).toHaveAttribute('href', `/products/${deviceProductId}/edit`);
  });

  test('diagnoses, adds the part from stock, sets labour RM120 and a promised date', async () => {
    await cashierPage.goto(`/repairs/${repairId}`);
    await cashierPage.getByRole('button', { name: 'Advance to Diagnosed' }).click();
    await expect(cashierPage.getByText('Repair advanced to Diagnosed')).toBeVisible({ timeout: 10000 });

    // Parts picker - only editable up to APPROVED (RepairJobService.PARTS_EDITABLE_STATUSES).
    await cashierPage.locator('#part-search').fill(partName);
    const partOption = cashierPage.locator('button', { hasText: partSku });
    await expect(partOption).toBeVisible({ timeout: 10000 });
    await partOption.click();
    await cashierPage.locator('#part-quantity').fill('1');
    await cashierPage.getByRole('button', { name: 'Add Part' }).click();
    await expect(cashierPage.getByText(`${partName} added`)).toBeVisible({ timeout: 10000 });

    await cashierPage.locator('#labour-cost').fill('120');
    const promisedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await cashierPage.locator('#promised-date').fill(promisedDate);
    await cashierPage.getByRole('button', { name: 'Save Details' }).click();
    await expect(cashierPage.getByText('Repair details saved')).toBeVisible({ timeout: 10000 });

    // Part cost (1 x RM40, from stock) + labour RM120 = RM160.
    await expect(cashierPage.locator(':text-is("Total") + *')).toHaveText(formatMoney(160));
    // Plain <dt> tag locator (not getByText, which also matches the form's own <label> with the
    // same text) - confirms the promised date actually round-tripped through Save into the Job
    // Details panel.
    await expect(cashierPage.locator('dt', { hasText: 'Promised date' })).toBeVisible();
  });

  test('advances through Awaiting Approval / Approved to In Repair - part stock drops 2 -> 1', async () => {
    for (const label of ['Awaiting Approval', 'Approved', 'In Repair']) {
      await cashierPage.getByRole('button', { name: `Advance to ${label}` }).click();
      await expect(cashierPage.getByText(`Repair advanced to ${label}`)).toBeVisible({ timeout: 10000 });
    }

    await inventoryPage.goto('/products');
    await inventoryPage.getByPlaceholder(/search by name or sku/i).fill(partSku);
    await inventoryPage.waitForTimeout(600); // debounced search
    const row = inventoryPage.locator('table tbody tr', { hasText: partSku });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: /edit/i }).click();
    await expect(inventoryPage).toHaveURL(/\/products\/.+\/edit/);
    await expect(inventoryPage.getByLabel(/stock quantity/i)).toHaveValue('1');
  });

  test('advances to Completed', async () => {
    await cashierPage.goto(`/repairs/${repairId}`);
    await cashierPage.getByRole('button', { name: 'Advance to Completed' }).click();
    await expect(cashierPage.getByText('Repair advanced to Completed')).toBeVisible({ timeout: 10000 });
  });

  test('refuses COLLECTED without payment', async () => {
    await cashierPage.getByRole('button', { name: 'Collect & Pay' }).click();
    await cashierPage.locator('#collect-amount').fill('0');
    await cashierPage.locator('#collect-method').selectOption('CASH');
    await cashierPage.getByRole('button', { name: 'Collect & Pay' }).last().click();

    // Backend rejects with 409 "Cannot collect repair job ...: payments recorded (0) are less
    // than the total cost (160)" (RepairJobService#guardFullyPaidUnlessWarrantyClaim).
    await expect(
      cashierPage.getByText(/cannot collect repair job|less than the total cost|check the amount covers/i)
    ).toBeVisible({ timeout: 10000 });

    await cashierPage.getByRole('button', { name: 'Cancel', exact: true }).click();
    const badge = cashierPage.locator('h1', { hasText: 'Repair' }).locator('xpath=following-sibling::span[1]');
    await expect(badge).toHaveText('Completed');
  });

  test('Collect & Pay RM160 by CARD succeeds and issues a workmanship warranty', async () => {
    await cashierPage.getByRole('button', { name: 'Collect & Pay' }).click();
    await cashierPage.locator('#collect-amount').fill('160');
    await cashierPage.locator('#collect-method').selectOption('CARD');
    await cashierPage.getByRole('button', { name: 'Collect & Pay' }).last().click();
    await expect(cashierPage.getByText(/repair collected and paid/i)).toBeVisible({ timeout: 10000 });

    const badge = cashierPage.locator('h1', { hasText: 'Repair' }).locator('xpath=following-sibling::span[1]');
    await expect(badge).toHaveText('Collected');
    await expect(cashierPage.getByText('Workmanship warranty')).toBeVisible();
    await expect(cashierPage.getByRole('link', { name: 'View warranty' })).toBeVisible({ timeout: 10000 });
  });

  test('the public repair lookup shows the job as collected', async () => {
    const response = await cashierPage.request.get(`/api/v1/public/repairs/${jobNumber}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.found).toBe(true);
    expect(body.jobNumber).toBe(jobNumber);
    expect(body.status).toBe('COLLECTED');
  });

  test('quote-declined path: cancelling a second job from Awaiting Approval consumes no part', async () => {
    await cashierPage.goto('/repairs/new');
    await fieldByLabel(cashierPage, 'Walk-in name').fill(`Repair Journey Decliner ${stamp}`);
    await fieldByLabel(cashierPage, 'Walk-in phone').fill(`016${`${stamp}`.slice(-8)}`);
    await fieldByLabel(cashierPage, 'Device description').fill('PS5, no HDMI output (second unit)');
    await fieldByLabel(cashierPage, 'Reported fault').fill('Same HDMI fault, customer wants a quote first');
    await cashierPage.getByRole('button', { name: 'Create Repair Job' }).click();
    const heading = cashierPage.getByRole('heading', { level: 1, name: 'Repair' });
    await expect(heading).toContainText('Repair RJ-', { timeout: 10000 });

    await cashierPage.getByRole('button', { name: 'Advance to Diagnosed' }).click();
    await expect(cashierPage.getByText('Repair advanced to Diagnosed')).toBeVisible({ timeout: 10000 });

    // Quote the same part (the one remaining unit) - it must not be consumed since this job
    // never reaches IN_REPAIR.
    await cashierPage.locator('#part-search').fill(partName);
    const partOption = cashierPage.locator('button', { hasText: partSku });
    await expect(partOption).toBeVisible({ timeout: 10000 });
    await partOption.click();
    await cashierPage.locator('#part-quantity').fill('1');
    await cashierPage.getByRole('button', { name: 'Add Part' }).click();
    await expect(cashierPage.getByText(`${partName} added`)).toBeVisible({ timeout: 10000 });

    await cashierPage.getByRole('button', { name: 'Advance to Awaiting Approval' }).click();
    await expect(cashierPage.getByText('Repair advanced to Awaiting Approval')).toBeVisible({ timeout: 10000 });

    const cancelTrigger = cashierPage.getByRole('button', { name: 'Cancel Job' });
    await expect(cancelTrigger).toBeVisible({ timeout: 10000 });
    await cancelTrigger.click();
    const cancelModal = modalByTitle(cashierPage, 'Cancel Repair Job');
    await expect(cancelModal).toBeVisible();
    await cancelModal.getByRole('button', { name: 'Cancel Job' }).click();
    await expect(cashierPage.getByText('Repair job cancelled')).toBeVisible({ timeout: 10000 });

    const badge = cashierPage.locator('h1', { hasText: 'Repair' }).locator('xpath=following-sibling::span[1]');
    await expect(badge).toHaveText('Cancelled');

    // Stock should still read 1 - cancellation from AWAITING_APPROVAL never went through
    // IN_REPAIR, so RepairJobService#consumePartsForRepair never ran.
    await inventoryPage.goto('/products');
    await inventoryPage.getByPlaceholder(/search by name or sku/i).fill(partSku);
    await inventoryPage.waitForTimeout(600);
    const row = inventoryPage.locator('table tbody tr', { hasText: partSku });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: /edit/i }).click();
    await expect(inventoryPage.getByLabel(/stock quantity/i)).toHaveValue('1');
  });
});
