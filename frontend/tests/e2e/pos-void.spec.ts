import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { createProductViaApi, createSaleViaApi, apiGet } from '../helpers/api-setup';

/**
 * PoS sale void/refund (V34).
 *
 * Reads directly from:
 *  - src/pages/pos/SalesHistoryPage.tsx / SaleDetailPage.tsx (the void action + badges)
 *  - src/pages/pos/RegisterPage.tsx ("Sales History" header button)
 *  - backend PosSaleController#voidSale (RoleRules.MANAGER_UP)
 *
 * Uses two separate logged-in pages (cashier, manager) rather than logging in/out mid-test, since
 * RoleRules.MANAGER_UP backs the void endpoint and the UI hides the action for non-managers - both
 * need to be exercised.
 */
test.describe.serial('PoS void/refund', () => {
  let cashierPage: Page;
  let managerPage: Page;
  let productId: string;
  let saleId: string;
  let saleNumber: string;

  test.beforeAll(async ({ browser }) => {
    cashierPage = await browser.newPage();
    managerPage = await browser.newPage();
    await login(cashierPage, 'cashier@mulaerp.com', 'admin123');
    await login(managerPage, 'manager@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await cashierPage.close();
    await managerPage.close();
  });

  test('cashier rings up a sale of a stocked item', async () => {
    const product = await createProductViaApi(cashierPage, {
      unitPrice: 80,
      costPrice: 30,
      acquisitionCost: 30,
      stockQuantity: 5,
    });
    productId = product.id;

    const sale = await createSaleViaApi(cashierPage, {
      paymentMethod: 'CASH',
      amountTendered: 80,
      lines: [{ productId, quantity: 1, unitPrice: 80 }],
    });
    saleId = sale.id as string;
    saleNumber = sale.saleNumber as string;
    expect(sale.status).toBe('COMPLETED');

    const productAfterSale = await apiGet(cashierPage, `/api/v1/products/${productId}`);
    expect(productAfterSale.stockQuantity).toBe(4);
  });

  test('sale appears COMPLETED on its detail page, with no void action for a cashier', async () => {
    // Sales History is a plain recency-ordered, paginated list with no search filter - checking
    // for a specific sale there would be flaky under parallel e2e workers seeding their own sales
    // concurrently, so that page just gets a smoke check; the deterministic assertions (status,
    // void action, badges) go through the detail page, addressed directly by id.
    await cashierPage.goto('/pos/sales');
    await expect(cashierPage.getByRole('heading', { name: 'Sales History' })).toBeVisible();

    await cashierPage.goto(`/pos/sales/${saleId}`);
    await expect(cashierPage.getByText(saleNumber)).toBeVisible();
    await expect(cashierPage.getByText('COMPLETED', { exact: true })).toBeVisible();
    // RoleRules.MANAGER_UP - a cashier must never see the void action, let alone use it.
    await expect(cashierPage.getByRole('button', { name: 'Void Sale' })).not.toBeVisible();
  });

  test('manager voids the sale with a reason, and it renders VOIDED with the audit trail', async () => {
    await managerPage.goto(`/pos/sales/${saleId}`);
    await expect(managerPage.getByText(saleNumber)).toBeVisible();

    await managerPage.getByRole('button', { name: 'Void Sale' }).click();
    await expect(managerPage.getByRole('heading', { name: 'Void Sale' })).toBeVisible();
    await managerPage.getByLabel('Reason for void').fill('e2e test: rung up in error');

    // Two "Void Sale" buttons are on screen now (the page action behind the modal, and the modal's
    // own confirm button, rendered after it in DOM order) - .last() targets the modal's.
    await managerPage.getByRole('button', { name: 'Void Sale' }).last().click();

    await expect(managerPage.getByText('VOIDED', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(managerPage.getByText(/Voided .* by manager@mulaerp\.com/)).toBeVisible();
    await expect(managerPage.getByText('Reason: e2e test: rung up in error')).toBeVisible();
    // Void action itself disappears once the sale is no longer COMPLETED - nothing left to void.
    await expect(managerPage.getByRole('button', { name: 'Void Sale' })).not.toBeVisible();
  });

  test('stock is returned with a SALE_VOID movement, and the original POS_SALE movement is untouched', async () => {
    const product = await apiGet(managerPage, `/api/v1/products/${productId}`);
    expect(product.stockQuantity).toBe(5);

    const movements = (await apiGet(managerPage, `/api/v1/inventory/movements?productId=${productId}`)) as {
      content: { movementType: string; quantityDelta: number; reference: string }[];
    };
    const saleMovement = movements.content.find((m) => m.movementType === 'POS_SALE');
    const voidMovement = movements.content.find((m) => m.movementType === 'SALE_VOID');
    expect(saleMovement).toBeTruthy();
    expect(saleMovement?.quantityDelta).toBe(-1);
    expect(saleMovement?.reference).toBe(saleNumber);
    expect(voidMovement).toBeTruthy();
    expect(voidMovement?.quantityDelta).toBe(1);
    expect(voidMovement?.reference).toBe(saleNumber);
  });

  test('voiding the same sale again is rejected', async () => {
    const response = await managerPage.request.post(`/api/v1/pos/sales/${saleId}/void`, {
      data: { reason: 'second attempt' },
    });
    expect(response.status()).toBe(409);
  });
});

/**
 * V36: guided part-exchange void reversal.
 *
 * Reads directly from PosSaleService#voidSale/#createSale (backend/src/main/java/com/mulaerp/pos)
 * and SaleDetailPage.tsx's part-exchange void warning/response summary.
 */
test.describe.serial('PoS void/refund - part-exchange (V36)', () => {
  let managerPage: Page;

  test.beforeAll(async ({ browser }) => {
    managerPage = await browser.newPage();
    await login(managerPage, 'manager@mulaerp.com', 'admin123');
  });

  test.afterAll(async () => {
    await managerPage.close();
  });

  test('voiding a part-exchange sale warns clearly, then reverses sold goods, the traded-in item, and the money', async () => {
    const soldProduct = await createProductViaApi(managerPage, {
      unitPrice: 150,
      costPrice: 40,
      acquisitionCost: 40,
      stockQuantity: 5,
    });

    // V38: a trade-in line with no productId (unlinked - not matched to an existing catalogue
    // product) now requires categoryId - any real category from the seeded/imported catalogue
    // works, this test doesn't care which one.
    const categories = (await apiGet(managerPage, '/api/v1/products/categories')) as unknown as { id: string }[];
    const categoryId = categories[0].id;

    const sale = (await createSaleViaApi(managerPage, {
      paymentMethod: 'CASH',
      amountTendered: 120,
      lines: [{ productId: soldProduct.id, quantity: 1, unitPrice: 150 }],
      tradeIn: {
        clientTradeInId: `e2e-tradein-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        payoutType: 'CASH',
        lines: [{ description: 'Traded-in Console', condition: 'GOOD', offeredCashValue: 30, offeredCreditValue: 40, categoryId }],
      },
    })) as { id: string; saleNumber: string; tradeInId: string };
    expect(sale.tradeInId).toBeTruthy();

    const tradeIn = (await apiGet(managerPage, `/api/v1/pos/trade-ins/${sale.tradeInId}`)) as {
      lines: { productId: string; productName: string }[];
    };
    const tradeInProductId = tradeIn.lines[0].productId;

    await managerPage.goto(`/pos/sales/${sale.id}`);
    await expect(managerPage.getByText(sale.saleNumber)).toBeVisible();
    await managerPage.getByRole('button', { name: 'Void Sale' }).click();
    await expect(managerPage.getByText('This sale includes a part-exchange trade-in')).toBeVisible();
    await managerPage.getByLabel('Reason for void').fill('e2e: part-exchange void reversal');
    await managerPage.getByRole('button', { name: 'Void Sale' }).last().click();

    await expect(managerPage.getByText('VOIDED', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(managerPage.getByText('What was reversed:')).toBeVisible();
    await expect(managerPage.getByText(/removed from stock again/)).toBeVisible();

    const soldProductAfter = await apiGet(managerPage, `/api/v1/products/${soldProduct.id}`);
    expect(soldProductAfter.stockQuantity).toBe(5);

    const tradeInProductAfter = await apiGet(managerPage, `/api/v1/products/${tradeInProductId}`);
    expect(tradeInProductAfter.stockQuantity).toBe(0);

    const movements = (await apiGet(managerPage, `/api/v1/inventory/movements?productId=${tradeInProductId}`)) as {
      content: { movementType: string; quantityDelta: number; reference: string }[];
    };
    const receiptMovement = movements.content.find((m) => m.movementType === 'TRADE_IN_RECEIPT');
    const voidMovement = movements.content.find((m) => m.movementType === 'TRADE_IN_VOID');
    expect(receiptMovement?.quantityDelta).toBe(1);
    expect(voidMovement?.quantityDelta).toBe(-1);
    expect(voidMovement?.reference).toBe(sale.saleNumber);
  });

  test('voiding a part-exchange sale is refused (409) once the traded-in item has been resold, and nothing changes', async () => {
    const soldProduct = await createProductViaApi(managerPage, {
      unitPrice: 150,
      costPrice: 40,
      acquisitionCost: 40,
      stockQuantity: 5,
    });

    // V38: same categoryId requirement for an unlinked trade-in line as the test above.
    const categories = (await apiGet(managerPage, '/api/v1/products/categories')) as unknown as { id: string }[];
    const categoryId = categories[0].id;

    const sale = (await createSaleViaApi(managerPage, {
      paymentMethod: 'CASH',
      amountTendered: 120,
      lines: [{ productId: soldProduct.id, quantity: 1, unitPrice: 150 }],
      tradeIn: {
        clientTradeInId: `e2e-tradein-unsafe-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        payoutType: 'CASH',
        lines: [{ description: 'Traded-in Camera', condition: 'GOOD', offeredCashValue: 30, offeredCreditValue: 40, categoryId }],
      },
    })) as { id: string; saleNumber: string; tradeInId: string };

    const tradeIn = (await apiGet(managerPage, `/api/v1/pos/trade-ins/${sale.tradeInId}`)) as {
      lines: { productId: string }[];
    };
    const tradeInProductId = tradeIn.lines[0].productId;

    // Resell the traded-in item to someone else at its own (payout-derived) unit price - the
    // safety check in PosSaleService#voidSale must now refuse the original sale's void.
    const resale = await createSaleViaApi(managerPage, {
      paymentMethod: 'CASH',
      amountTendered: 30,
      lines: [{ productId: tradeInProductId, quantity: 1, unitPrice: 30 }],
    });
    expect(resale.status).toBe('COMPLETED');

    const voidResponse = await managerPage.request.post(`/api/v1/pos/sales/${sale.id}/void`, {
      data: { reason: 'e2e: attempt unsafe part-exchange void' },
    });
    expect(voidResponse.status()).toBe(409);
    const body = await voidResponse.json();
    expect(body.message).toContain('already moved on');

    // Nothing changed: the original sale is still COMPLETED, and the traded-in product's stock
    // (already resold to 0) is untouched by the refused void.
    const saleAfter = await apiGet(managerPage, `/api/v1/pos/sales/${sale.id}`);
    expect(saleAfter.status).toBe('COMPLETED');
    const tradeInProductAfter = await apiGet(managerPage, `/api/v1/products/${tradeInProductId}`);
    expect(tradeInProductAfter.stockQuantity).toBe(0);
  });
});
