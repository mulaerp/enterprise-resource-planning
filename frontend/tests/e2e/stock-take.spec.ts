import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { apiLogin, apiGet, createProductViaApi } from '../helpers/api-setup';

test.describe('Stock Takes', () => {
  test('should display stock takes list shell', async ({ page }) => {
    await login(page);
    await page.goto('/inventory/stock-takes');

    await expect(page.getByRole('heading', { name: /stock takes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new stock take/i })).toBeVisible();
    // Scoped to the status-filter pill, not `getByText` - on a long-lived stack with several
    // stock takes already in OPEN status, a bare text match resolves to the filter button *and*
    // every OPEN badge in the list, tripping Playwright's strict-mode uniqueness check.
    await expect(page.getByRole('button', { name: /^open$/i })).toBeVisible();
  });

  test('full count -> submit -> approve flow with variance assertion', async ({ page, browser }) => {
    test.setTimeout(60000);

    // --- API setup: an isolated warehouse + product so the count sheet has exactly one line,
    // rather than scanning through whatever else already has stock in MAIN. ---
    await apiLogin(page, 'inventory@mulaerp.com', 'admin123');

    const stamp = Date.now();
    const warehouseRes = await page.request.post('/api/v1/warehouses', {
      data: { code: `E2E-ST-${stamp}`, name: `E2E Stock Take Warehouse ${stamp}` },
    });
    expect(warehouseRes.ok()).toBeTruthy();
    const warehouse = await warehouseRes.json();

    // stockQuantity: 0 so ProductService doesn't seed opening stock into MAIN - all of this
    // product's stock lives in the dedicated warehouse via the adjustment below.
    const product = await createProductViaApi(page, {
      name: `Stock Take E2E ${stamp}`,
      stockQuantity: 0,
    });

    const adjustRes = await page.request.post('/api/v1/inventory/adjustments', {
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        adjustmentType: 'INCREASE',
        quantityAdjusted: 10,
        reason: 'E2E seed stock for stock-take test',
      },
    });
    expect(adjustRes.ok()).toBeTruthy();

    const openRes = await page.request.post('/api/v1/inventory/stock-takes', {
      data: { warehouseId: warehouse.id, notes: 'Playwright e2e session' },
    });
    expect(openRes.ok()).toBeTruthy();
    const session = await openRes.json();
    expect(session.totalLines).toBe(1);

    // --- UI: count as inventory@ ---
    // apiLogin above already set the MULAERP_AUTH cookie on this same page/context (see
    // api-setup.ts's docstring) - the UI login() below does page.goto('/login'), which redirects
    // straight to /dashboard for an already-authenticated session (see auth.spec.ts's "should
    // redirect to dashboard if already logged in") and never renders the email field, so login()
    // hangs for the full test timeout waiting on a field that will never appear. Clear cookies
    // first, same as this file's CASHIER test does when switching users.
    await page.context().clearCookies();
    await login(page, 'inventory@mulaerp.com', 'admin123');
    await page.goto(`/inventory/stock-takes/${session.id}`);

    await expect(page.getByRole('heading', { name: session.sessionNumber })).toBeVisible();
    await expect(page.getByText(product.sku)).toBeVisible();

    const countedInput = page.getByLabel(`Counted quantity for ${product.sku}`);
    await countedInput.fill('7');
    // Enter both records the count (via blur) and moves focus to the next row - there is no next
    // row here (only one line), so this also exercises the "no next input" no-op path.
    await countedInput.press('Enter');

    await expect(page.getByText('-3', { exact: true })).toBeVisible();
    // Header summary card ("Counted") reflects the just-saved count once StockTakeDetailPage
    // re-fetches the session after the PUT.
    await expect(page.getByText('1 / 1')).toBeVisible();

    // Approve is INVENTORY-invisible (RoleRules.MANAGER_UP) even once the session reaches REVIEW.
    await page.getByRole('button', { name: /submit for review/i }).click();
    await expect(page.getByText('REVIEW', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0);

    // --- UI: approve as manager@, a separate browser context so both sessions are live at once ---
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    try {
      await login(managerPage, 'manager@mulaerp.com', 'admin123');
      await managerPage.goto(`/inventory/stock-takes/${session.id}`);

      await managerPage.getByRole('button', { name: /^approve$/i }).click();
      await expect(managerPage.getByText(/will create/i)).toBeVisible();
      await managerPage.getByRole('button', { name: /confirm approval/i }).click();

      await expect(managerPage.getByText('APPROVED', { exact: true })).toBeVisible();

      // Approving twice must 409 - the UI's own Approve button is now gone (status !== REVIEW),
      // so assert the backend contract directly. Must go through managerPage's own request
      // context (authenticated as manager@, RoleRules.MANAGER_UP) - `page` is still authenticated
      // as inventory@, which isn't permitted to call approve at all and would 403 regardless of
      // the session's already-approved state, never actually exercising the 409 path.
      const secondApprove = await managerPage.request.post(
        `/api/v1/inventory/stock-takes/${session.id}/approve`
      );
      expect(secondApprove.status()).toBe(409);
    } finally {
      await managerContext.close();
    }

    // --- Assert the stock effect: product total, warehouse_stock, and the RECOUNT ledger row ---
    const productAfter = await apiGet(page, `/api/v1/products/${product.id}`);
    expect(productAfter.stockQuantity).toBe(7);

    const stockRows = await apiGet(page, `/api/v1/warehouses/${warehouse.id}/stock`);
    const row = stockRows.find((r: { productId: string }) => r.productId === product.id);
    expect(row?.quantity).toBe(7);

    const adjustments = await apiGet(page, `/api/v1/inventory/adjustments/product/${product.id}`);
    const recountAdjustment = adjustments.find(
      (a: { adjustmentType: string }) => a.adjustmentType === 'RECOUNT'
    );
    expect(recountAdjustment).toBeTruthy();
    expect(recountAdjustment.quantityAfter).toBe(7);
    expect(recountAdjustment.approvedBy).toBe('manager@mulaerp.com');

    const movements = await apiGet(page, `/api/v1/inventory/movements?productId=${product.id}`);
    const recountMovement = movements.content.find(
      (m: { movementType: string }) => m.movementType === 'RECOUNT'
    );
    expect(recountMovement).toBeTruthy();
    expect(recountMovement.quantityDelta).toBe(-3);
    expect(recountMovement.reference).toBe(recountAdjustment.adjustmentNumber);
  });

  test('CASHIER is forbidden from opening or counting a stock take', async ({ page }) => {
    await apiLogin(page, 'inventory@mulaerp.com', 'admin123');
    const warehouses = await apiGet(page, '/api/v1/warehouses?size=50');
    const main = warehouses.content.find((w: { code: string }) => w.code === 'MAIN');
    expect(main).toBeTruthy();

    await page.context().clearCookies();
    await apiLogin(page, 'cashier@mulaerp.com', 'admin123');

    const openRes = await page.request.post('/api/v1/inventory/stock-takes', {
      data: { warehouseId: main.id },
    });
    expect(openRes.status()).toBe(403);
  });

  test('cancelling a stock take has no stock effect', async ({ page }) => {
    await apiLogin(page, 'inventory@mulaerp.com', 'admin123');

    const stamp = Date.now();
    const warehouseRes = await page.request.post('/api/v1/warehouses', {
      data: { code: `E2E-CANCEL-${stamp}`, name: `E2E Cancel Warehouse ${stamp}` },
    });
    const warehouse = await warehouseRes.json();

    const product = await createProductViaApi(page, {
      name: `Stock Take Cancel E2E ${stamp}`,
      stockQuantity: 0,
    });
    await page.request.post('/api/v1/inventory/adjustments', {
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        adjustmentType: 'INCREASE',
        quantityAdjusted: 5,
        reason: 'E2E seed stock for cancel test',
      },
    });

    const session = await (
      await page.request.post('/api/v1/inventory/stock-takes', { data: { warehouseId: warehouse.id } })
    ).json();

    const stockBefore = await apiGet(page, `/api/v1/products/${product.id}`);
    expect(stockBefore.stockQuantity).toBe(5);

    const cancelRes = await page.request.post(`/api/v1/inventory/stock-takes/${session.id}/cancel`);
    expect(cancelRes.ok()).toBeTruthy();
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe('CANCELLED');

    const stockAfter = await apiGet(page, `/api/v1/products/${product.id}`);
    expect(stockAfter.stockQuantity).toBe(5);
  });
});
