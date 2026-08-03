import { test, expect, type Page } from '@playwright/test';
import { apiLogin, apiGet } from '../../helpers/api-setup';

/**
 * WEBSHOP persona (ii) - MEMBER buyer: registers/logs in, checks out with postage, sees the order
 * in account history, earns loyalty points on fulfilment, and (GAP B, now fixed) has a warranty
 * auto-issued by the online purchase itself - checked both via the account page's Warranties tab
 * and surfaced directly on the Orders tab, plus independently via the public warranty checker.
 *
 * The loyalty points/store-credit link only activates when `ShopAuthService#register` finds an
 * existing loyalty `Member` sharing the same email - see the `webshop` skill. A Member is created
 * first via the staff API with the exact email the UI registration form will use, so the auto-link
 * fires for real (not asserted from reading the code).
 */
test.describe.serial('WEBSHOP persona: MEMBER buyer end-to-end', () => {
  let managerPage: Page;
  const stamp = Date.now();
  const itemName = `Persona Member Item ${stamp}`;
  const itemSku = `PMEMBER-${stamp}`;
  const sellPrice = 250;
  const acquisitionCost = 100;
  const memberEmail = `persona-member-${stamp}@example.com`;
  const deliveryFee = 0; // mulaerp.shop.order.delivery-fee default - see webshop skill

  let memberId: string;
  let orderNumber: string;
  let warrantyNumber: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await browser.newPage();
    await apiLogin(managerPage, 'manager@mulaerp.com', 'admin123');

    const memberRes = await managerPage.request.post('/api/v1/members', {
      data: { name: 'Persona Member Buyer', email: memberEmail, phone: `+601${stamp}`.slice(0, 14) },
    });
    expect(memberRes.ok(), `member create failed: ${memberRes.status()}`).toBeTruthy();
    memberId = (await memberRes.json()).id;

    const productRes = await managerPage.request.post('/api/v1/products', {
      data: {
        sku: itemSku,
        name: itemName,
        unitPrice: sellPrice,
        costPrice: acquisitionCost,
        acquisitionCost,
        stockQuantity: 1,
        reorderLevel: 0,
        status: 'ACTIVE',
        condition: 'GOOD',
        warrantyMonths: 6, // needed for the "check a warranty" leg of this persona
      },
    });
    expect(productRes.ok(), `product create failed: ${productRes.status()}`).toBeTruthy();
  });

  test.afterAll(async () => {
    await managerPage.close();
  });

  test('registers, logs in, checks out with postage, and sees the order in account history', async ({ page }) => {
    await page.goto('/shop/register');
    await page.getByLabel('Full name').fill('Persona Member Buyer');
    await page.getByLabel('Email address').fill(memberEmail);
    await page.getByLabel('Phone').fill('0198765432');
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    // Confirm the auto-link actually happened for this session (not just assumed).
    const me = await page.request.get('/api/v1/shop/auth/me');
    expect((await me.json()).memberId).toBe(memberId);

    await page.goto('/');
    const search = page.getByLabel('Search products');
    await search.fill(itemName);
    const cardLink = page.locator('a[href^="/shop/item/"]', { hasText: itemName });
    await expect(cardLink).toBeVisible({ timeout: 10000 });
    const card = cardLink.locator('xpath=..');
    await card.getByRole('button', { name: /add to cart/i }).click();
    await expect(card.getByRole('button', { name: /added/i })).toBeVisible();

    await page.getByRole('link', { name: /view cart/i }).click();
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL(/\/shop\/checkout$/);

    // Signed-in customer sees their own details, not a guest form.
    await expect(page.getByText(memberEmail)).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveCount(0);

    // Postage fulfilment.
    await page.locator('input[name="fulfilmentType"]').nth(1).check();
    await page.getByLabel('Delivery address').fill('42 Jalan Member, 50000 Kuala Lumpur');
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page).toHaveURL(/\/shop\/order-confirmation\/(WEB-\S+)/, { timeout: 10000 });
    orderNumber = page.url().split('/').pop()!;

    await page.goto('/shop/account');
    await page.getByRole('button', { name: 'Orders' }).click();
    await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 10000 });
  });

  test('staff fulfils the postage order: member earns points on the full order value (goods + delivery)', async () => {
    const memberBefore = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    const pointsBefore = memberBefore.points as number;

    const orderRes = await managerPage.request.get(`/api/v1/shop/admin/orders?status=RESERVED&size=50`);
    const orders = (await orderRes.json()).content as Array<{ orderNumber: string; id: string; total: number }>;
    const order = orders.find((o) => o.orderNumber === orderNumber);
    expect(order).toBeTruthy();
    expect(order!.total).toBeCloseTo(sellPrice + deliveryFee, 2);

    const fulfilRes = await managerPage.request.post(`/api/v1/shop/admin/orders/${order!.id}/fulfil`, { data: {} });
    expect(fulfilRes.ok(), await fulfilRes.text()).toBeTruthy();

    const memberAfter = await apiGet(managerPage, `/api/v1/members/${memberId}`);
    expect(memberAfter.points as number).toBe(pointsBefore + Math.floor(order!.total)); // floor(total), same rule as PoS

    // Books balance for this order too.
    const journalEntries = await apiGet(managerPage, '/api/v1/accounting/journal-entries');
    const entries = Array.isArray(journalEntries) ? journalEntries : (journalEntries as { content: unknown[] }).content;
    const orderEntries = (entries as Array<Record<string, unknown>>).filter((e) => e.reference === orderNumber);
    for (const entry of orderEntries) {
      const lines = entry.lines as Array<{ debit: number; credit: number }>;
      expect(lines.reduce((s, l) => s + Number(l.debit), 0)).toBeCloseTo(
        lines.reduce((s, l) => s + Number(l.credit), 0),
        2
      );
    }

    // GAP B (fixed): the fulfil response itself now carries the warranty auto-issued for this
    // ONLINE order - fulfilOrder calls WarrantyService#autoIssueForShopOrderLine, mirroring
    // PosSaleService exactly, no PoS-sale workaround needed any more (see below).
    const fulfilledOrder = await fulfilRes.json();
    expect(fulfilledOrder.warrantyNumbers, 'the online purchase itself should have issued a warranty').toHaveLength(1);
    warrantyNumber = fulfilledOrder.warrantyNumbers[0];
  });

  test('checks the warranty auto-issued by the ONLINE purchase itself, from the account page', async ({ page }) => {
    // Independently verifiable via the public checker too, before even logging in - proves the
    // warranty is real and not just an artefact of the fulfil response.
    const publicCheck = await managerPage.request.get(`/api/v1/public/warranty/${warrantyNumber}`);
    expect((await publicCheck.json()).found).toBe(true);

    await page.goto('/shop/login');
    await page.getByLabel('Email address').fill(memberEmail);
    await page.getByLabel('Password').fill('Password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/shop\/account$/, { timeout: 10000 });

    await page.getByRole('button', { name: 'Warranties' }).click();
    await page.getByLabel('Warranty or serial number').fill(warrantyNumber);
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText(new RegExp(itemName))).toBeVisible({ timeout: 10000 });

    // GAP B: the warranty number is also surfaced directly on the Orders tab (no manual lookup
    // needed) - ShopOrderDto#warrantyNumbers renders on each order row.
    await page.getByRole('button', { name: 'Orders' }).click();
    await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(warrantyNumber)).toBeVisible();
  });
});
