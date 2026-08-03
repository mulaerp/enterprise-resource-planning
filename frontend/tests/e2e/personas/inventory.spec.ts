import { test, expect, type Page } from '@playwright/test';
import { login } from '../../helpers/auth';
import { apiGet } from '../../helpers/api-setup';

/**
 * Persona 4 - Inventory staff (INVENTORY role).
 *
 * Reads directly from:
 *  - src/pages/products/ProductFormPage.tsx (stock quantity read-only once a product exists)
 *  - src/pages/inventory/{StockAdjustmentFormPage,StockMovementsPage,StockTransferFormPage,
 *    StockTransferListPage,WarehouseFormPage,WarehouseStockPage}.tsx
 *  - backend InventoryService (negative-stock guard), StockMovementService (append-only ledger +
 *    reconcile), StockTransferService (TRANSFER_OUT/TRANSFER_IN only written at
 *    completeTransfer - see StockTransferListPage's status-advance actions)
 *
 * Every stock event must leave a StockMovement row (see the `inventory` skill) - this spec checks
 * the ledger and the reconcile endpoint directly, not just the success toasts.
 */
test.describe.serial('Persona: Inventory staff (INVENTORY)', () => {
  let page: Page;
  const stamp = Date.now();
  const productSku = `INV-PERSONA-${stamp}`;
  const productName = `Inventory Persona Product ${stamp}`;
  let productId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, 'inventory@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('creates a product with opening stock 10, then finds the Stock Quantity field read-only on edit', async () => {
    await page.goto('/products/new');
    await page.getByLabel(/sku/i).fill(productSku);
    await page.getByLabel(/^name/i).fill(productName);
    await page.getByLabel(/unit price/i).fill('50');
    await page.getByLabel(/cost price/i).fill('20');
    await page.getByLabel(/stock quantity/i).fill('10');
    await page.getByLabel(/reorder level/i).fill('2');
    await page.getByRole('button', { name: /save|create/i }).click();
    // Not a generic /success|created/i regex: this catalogue has 800+ products accumulated from
    // other e2e runs, and at least one has "Created" literally in its name - a <select> full of
    // such option text still counts towards getByText()'s strict-mode match even while closed.
    await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 10000 });

    await page.goto('/products');
    await page.getByPlaceholder(/search by name or sku/i).fill(productSku);
    await page.waitForTimeout(600); // debounced search
    const row = page.locator('table tbody tr', { hasText: productSku });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: /edit/i }).click();
    await expect(page).toHaveURL(/\/products\/.+\/edit/);
    productId = page.url().split('/').slice(-2, -1)[0];
    expect(productId).toBeTruthy();

    const stockField = page.getByLabel(/stock quantity/i);
    await expect(stockField).toHaveValue('10');
    await expect(stockField).toBeDisabled();
    await expect(page.getByText("Stock quantity can't be edited here.")).toBeVisible();
  });

  test('makes a +5 adjustment and sees a matching movement row in the ledger', async () => {
    await page.goto('/inventory/adjustments/new');
    const productSelect = page.getByLabel(/^product/i);
    await productSelect.selectOption({ label: `${productName} (Current: 10)` });
    await page.getByLabel(/warehouse/i).selectOption({ label: 'Main Warehouse' });
    await page.getByLabel(/adjustment type/i).selectOption('INCREASE');
    await page.getByLabel(/quantity/i).fill('5');
    await page.getByLabel(/reason/i).fill('E2E persona restock');
    await page.getByRole('button', { name: /^save$/i }).click();
    // See the product-creation test above for why this isn't a generic /success|created/i regex -
    // this page's own product <select> has 800+ options, some containing "Created".
    await expect(page.getByText('Stock adjustment created successfully')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/inventory\/adjustments$/);

    await page.goto('/inventory/movements');
    // ProductSelector's option label is "<sku> - <name> (<formatted unit price>)".
    const movementProductSelect = page.getByLabel('Product');
    const option = movementProductSelect.locator('option', { hasText: productSku });
    await expect(option).toHaveCount(1, { timeout: 10000 });
    const value = await option.getAttribute('value');
    await movementProductSelect.selectOption(value!);
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    const row = page.locator('table tbody tr', { hasText: 'ADJUSTMENT' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('+5');
    await expect(row).toContainText('15'); // Total After
    await expect(row).toContainText('ADJ-'); // Reference
  });

  test("runs reconcile for that product and it's reported consistent", async () => {
    await page.goto('/inventory/movements');
    const movementProductSelect = page.getByLabel('Product');
    const option = movementProductSelect.locator('option', { hasText: productSku });
    const value = await option.getAttribute('value');
    await movementProductSelect.selectOption(value!);
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    const reconcileCard = page.locator('h2', { hasText: 'Reconciliation' }).locator('xpath=..');
    await expect(reconcileCard).toBeVisible({ timeout: 10000 });
    await expect(reconcileCard.getByText('Current Stock').locator('xpath=following-sibling::div')).toHaveText('15');
    await expect(reconcileCard.getByText('Ledger Sum').locator('xpath=following-sibling::div')).toHaveText('15');
    await expect(reconcileCard.getByText('Yes')).toBeVisible();
  });

  let mainWarehouseId: string;
  let secondWarehouseId: string;
  let secondWarehouseName: string;
  let transferNumber: string;

  test('transfers stock to a new warehouse - TRANSFER_OUT/TRANSFER_IN rows appear and per-warehouse quantities sum to the product total', async () => {
    const warehouses = await apiGet(page, '/api/v1/warehouses?size=1000');
    const main = warehouses.content.find((w: { code: string }) => w.code === 'MAIN');
    expect(main, 'a MAIN warehouse should exist (seeded by V2/V16 migrations)').toBeTruthy();
    mainWarehouseId = main.id;

    secondWarehouseName = `Persona Overflow ${stamp}`;
    await page.goto('/inventory/warehouses/new');
    await page.getByLabel(/code/i).fill(`OVF${stamp}`.slice(0, 20));
    await page.getByLabel(/^name/i).fill(secondWarehouseName);
    await page.getByRole('button', { name: /create warehouse/i }).click();
    await expect(page.getByText('Warehouse created successfully')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/inventory\/warehouses$/, { timeout: 10000 });

    const warehousesAfter = await apiGet(page, '/api/v1/warehouses?size=1000');
    const second = warehousesAfter.content.find((w: { name: string }) => w.name === secondWarehouseName);
    expect(second).toBeTruthy();
    secondWarehouseId = second.id;

    await page.goto('/inventory/transfers/new');
    await page.getByLabel(/from warehouse/i).selectOption({ label: 'Main Warehouse' });
    await page.getByLabel(/to warehouse/i).selectOption({ label: secondWarehouseName });
    const productSelect = page.locator('select').last();
    const option = productSelect.locator('option', { hasText: productSku });
    await expect(option).toHaveCount(1, { timeout: 10000 });
    const value = await option.getAttribute('value');
    await productSelect.selectOption(value!);
    await page.locator('input[type="number"]').first().fill('3');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('Transfer created successfully')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/inventory\/transfers$/, { timeout: 10000 });

    const transfers = await apiGet(page, '/api/v1/stock-transfers');
    const created = transfers.find(
      (t: { fromWarehouseId: string; toWarehouseId: string; items: Array<{ productId: string }> }) =>
        t.fromWarehouseId === mainWarehouseId &&
        t.toWarehouseId === secondWarehouseId &&
        t.items.some((i) => i.productId === productId)
    );
    expect(created, 'the just-created transfer should be findable via the API').toBeTruthy();
    transferNumber = created.transferNumber;

    // BUG FIX (see StockTransferListPage.tsx): these two status-advance actions didn't exist in
    // the UI before this persona spec was written - a transfer could be created but never
    // actually completed, so TRANSFER_OUT/TRANSFER_IN could never be written. Verify the fix here.
    await page.goto('/inventory/transfers');
    await page.getByRole('button', { name: `Mark transfer ${transferNumber} in transit` }).click();
    await expect(page.getByText('Transfer marked in transit')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: `Complete transfer ${transferNumber}` }).click();
    await expect(page.getByText('Transfer completed')).toBeVisible({ timeout: 10000 });

    await page.goto('/inventory/movements');
    const movementProductSelect = page.getByLabel('Product');
    const movementOption = movementProductSelect.locator('option', { hasText: productSku });
    const movementValue = await movementOption.getAttribute('value');
    await movementProductSelect.selectOption(movementValue!);
    await page.getByRole('button', { name: 'Apply Filters' }).click();

    const outRow = page.locator('table tbody tr', { hasText: 'TRANSFER_OUT' }).first();
    await expect(outRow).toBeVisible({ timeout: 10000 });
    await expect(outRow).toContainText('-3');
    await expect(outRow).toContainText(transferNumber);

    const inRow = page.locator('table tbody tr', { hasText: 'TRANSFER_IN' }).first();
    await expect(inRow).toBeVisible({ timeout: 10000 });
    await expect(inRow).toContainText('+3');
    await expect(inRow).toContainText(transferNumber);

    // Per-warehouse quantities must still sum to the product's total (15) - a transfer only ever
    // moves stock between warehouse_stock rows, Product.stockQuantity is unaffected.
    await page.goto(`/inventory/warehouses/${mainWarehouseId}/stock`);
    const mainRow = page.locator('table tbody tr', { hasText: productSku });
    await expect(mainRow).toBeVisible({ timeout: 10000 });
    const mainQty = parseInt((await mainRow.locator('td').last().textContent()) ?? '0', 10);

    await page.goto(`/inventory/warehouses/${secondWarehouseId}/stock`);
    const secondRow = page.locator('table tbody tr', { hasText: productSku });
    await expect(secondRow).toBeVisible({ timeout: 10000 });
    const secondQty = parseInt((await secondRow.locator('td').last().textContent()) ?? '0', 10);

    expect(mainQty).toBe(12);
    expect(secondQty).toBe(3);
    expect(mainQty + secondQty).toBe(15);
  });

  test('rejects an adjustment that would take stock negative', async () => {
    await page.goto('/inventory/adjustments/new');
    const productSelect = page.getByLabel(/^product/i);
    await productSelect.selectOption({ label: `${productName} (Current: 15)` });
    await page.getByLabel(/warehouse/i).selectOption({ label: 'Main Warehouse' });
    await page.getByLabel(/adjustment type/i).selectOption('DECREASE');
    await page.getByLabel(/quantity/i).fill('999');
    await page.getByLabel(/reason/i).fill('E2E negative-stock rejection check');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(/would take product .* stock negative/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/inventory\/adjustments\/new$/);
  });

  test('is blocked from posting journals and from the P&L', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Accounting' })).toHaveCount(0);

    await page.goto('/accounting/journal-entries/post-drafts');
    // .first(): React StrictMode double-invokes the mount-time fetch effect in dev, so a failed
    // fetch's error toast can render twice.
    await expect(page.getByText('You do not have permission to access this resource').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/no draft journal entries found/i)).not.toBeVisible();

    await page.goto('/accounting/profit-loss');
    await expect(page.getByText('Failed to fetch profit & loss report').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /^revenue$/i })).not.toBeVisible();
  });
});
