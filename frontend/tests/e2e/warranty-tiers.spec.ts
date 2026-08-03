import { test, expect, type Page } from '@playwright/test';
import { login } from '../helpers/auth';
import { apiLogin, createProductViaApi, createSaleViaApi, apiGet } from '../helpers/api-setup';

/**
 * WARRANTY-TIERS (V44) - guest/member channel-base warranty days, editable at runtime via the
 * new "Commercial Terms" manager page, and the FLOOR rule that a product's own warrantyMonths
 * (converted to a date) always wins over the channel base when it would cover longer.
 *
 * Reads directly from:
 *  - backend com.mulaerp.settings.** (SettingsController/SettingsService/AppSetting, V44)
 *  - backend com.mulaerp.warranty.service.WarrantyService#resolveDuration (the shared max()-rule
 *    helper), #autoIssueForPosSaleLine / #autoIssueForShopOrderLine (the two call sites)
 *  - frontend src/pages/settings/CommercialTermsPage.tsx (new, manager-only)
 *  - frontend src/components/Layout.tsx (the "Commercial Terms" nav item, MANAGER/ADMIN only)
 *
 * The PoS floor-rule tests below deliberately assert `durationSource`/`coverageLabel` substrings
 * rather than an exact day count - the UI test block in this same file exercises PUT
 * /api/v1/settings against the SAME `warranty.guest-base-days` key, and Playwright's
 * `fullyParallel: true` means the two describe blocks can interleave across workers. Asserting
 * "some positive GUEST_BASE duration" rather than "exactly 3 days" keeps this spec correct
 * regardless of which value happens to be live when a given sale runs.
 */

interface WarrantyListItem {
  warrantyNumber: string;
  durationSource: 'PRODUCT_MONTHS' | 'GUEST_BASE' | 'MEMBER_BASE';
  months: number | null;
  durationDays: number | null;
  coverageLabel: string;
}

test.describe.serial('WARRANTY-TIERS: Commercial Terms page (branch manager)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, 'manager@mulaerp.com');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('lists both warranty base-days settings with their description and current value', async () => {
    await page.goto('/oversight/settings');
    await expect(page.getByRole('heading', { name: 'Commercial Terms', level: 1 })).toBeVisible();

    await expect(page.getByText('Warranty Guest Base Days', { exact: true })).toBeVisible();
    await expect(page.getByText(/Base in-house warranty \(days\) for a guest/)).toBeVisible();
    await expect(page.getByText('Warranty Member Base Days', { exact: true })).toBeVisible();
    await expect(page.getByText(/loyalty-member purchase/)).toBeVisible();
  });

  test('rejects a negative value inline, without ever calling the API', async () => {
    const guestBlock = page.locator('div.p-6.space-y-3', { hasText: 'Warranty Guest Base Days' });
    const guestInput = guestBlock.locator('input');

    await guestInput.fill('-1');
    await guestBlock.getByRole('button', { name: 'Save' }).click();
    await expect(guestBlock.getByText('Must be zero or greater')).toBeVisible();
  });

  test('saves a new value at runtime with a success toast, then reverts it', async () => {
    const guestBlock = page.locator('div.p-6.space-y-3', { hasText: 'Warranty Guest Base Days' });
    const guestInput = guestBlock.locator('input');

    await guestInput.fill('4');
    await guestBlock.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Warranty Guest Base Days updated to 4/)).toBeVisible({ timeout: 10000 });

    // Revert so the seeded default (3) is left for any other spec/manual check reading it.
    await guestInput.fill('3');
    await guestBlock.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Warranty Guest Base Days updated to 3/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('WARRANTY-TIERS: Commercial Terms is hidden from non-manager roles', () => {
  test('a cashier gets no nav link and a restricted message on direct navigation', async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'cashier@mulaerp.com');

    await expect(page.getByRole('link', { name: 'Commercial Terms' })).toHaveCount(0);

    await page.goto('/oversight/settings');
    await expect(
      page.getByText('Only branch managers and admins can view or change commercial terms.')
    ).toBeVisible();

    await page.close();
  });
});

test.describe.serial('WARRANTY-TIERS: the FLOOR rule at the PoS register (API-level)', () => {
  let page: Page;
  let stamp: number;
  let noWarrantyProductId: string;
  let noWarrantyProductName: string;
  let sixMonthProductId: string;
  let sixMonthProductName: string;
  let memberId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await apiLogin(page, 'cashier@mulaerp.com', 'admin123');
    stamp = Date.now();

    noWarrantyProductName = `Tiers No-Warranty ${stamp}`;
    const p1 = await createProductViaApi(page, {
      sku: `TIERS-NOWTY-${stamp}`, name: noWarrantyProductName,
      unitPrice: 40, costPrice: 15, stockQuantity: 10,
    });
    noWarrantyProductId = p1.id;

    sixMonthProductName = `Tiers Six Month ${stamp}`;
    const p2 = await createProductViaApi(page, {
      sku: `TIERS-6MO-${stamp}`, name: sixMonthProductName,
      unitPrice: 90, costPrice: 40, stockQuantity: 10, warrantyMonths: 6,
    });
    sixMonthProductId = p2.id;

    const memberResponse = await page.request.post('/api/v1/members', {
      data: { name: `Tiers Member ${stamp}`, email: `tiers.member.${stamp}@example.test`, phone: `+601${stamp}`.slice(0, 14) },
    });
    expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy();
    memberId = (await memberResponse.json()).id;
  });

  test.afterAll(async () => {
    await page.close();
  });

  /** Warranty list default-sorts createdAt descending (WarrantyController), so the newest warranty
   * for a given (unique, timestamped) product name is always content[0]. */
  async function latestWarrantyFor(productName: string): Promise<WarrantyListItem> {
    const list = await apiGet(page, `/api/v1/warranties?search=${encodeURIComponent(productName)}&size=10`);
    const content = list.content as WarrantyListItem[];
    expect(content.length).toBeGreaterThan(0);
    return content[0];
  }

  test('DELIBERATE BEHAVIOUR CHANGE: a walk-in sale of a product with NO warrantyMonths now issues a GUEST_BASE warranty', async () => {
    const sale = await createSaleViaApi(page, {
      paymentMethod: 'CASH', amountTendered: 40,
      lines: [{ productId: noWarrantyProductId, quantity: 1, unitPrice: 40 }],
    });
    expect(sale.saleNumber).toBeTruthy();

    const warranty = await latestWarrantyFor(noWarrantyProductName);
    expect(warranty.durationSource).toBe('GUEST_BASE');
    expect(warranty.months).toBeNull();
    expect(warranty.durationDays).toBeGreaterThan(0);
    expect(warranty.coverageLabel).toContain('(guest)');
  });

  test('the SAME no-warranty product sold to a MEMBER issues the longer MEMBER_BASE warranty', async () => {
    const sale = await createSaleViaApi(page, {
      memberId, paymentMethod: 'CASH', amountTendered: 40,
      lines: [{ productId: noWarrantyProductId, quantity: 1, unitPrice: 40 }],
    });
    expect(sale.saleNumber).toBeTruthy();

    const warranty = await latestWarrantyFor(noWarrantyProductName);
    expect(warranty.durationSource).toBe('MEMBER_BASE');
    expect(warranty.months).toBeNull();
    expect(warranty.durationDays).toBeGreaterThan(0);
    expect(warranty.coverageLabel).toContain('(member)');
  });

  test('FLOOR RULE: a walk-in sale of a 6-month-warranty product keeps the full 6 months, never shortened to the guest base', async () => {
    const sale = await createSaleViaApi(page, {
      paymentMethod: 'CASH', amountTendered: 90,
      lines: [{ productId: sixMonthProductId, quantity: 1, unitPrice: 90 }],
    });
    expect(sale.saleNumber).toBeTruthy();

    const warranty = await latestWarrantyFor(sixMonthProductName);
    expect(warranty.durationSource).toBe('PRODUCT_MONTHS');
    expect(warranty.months).toBe(6);
    expect(warranty.durationDays).toBeNull();
    expect(warranty.coverageLabel).toBe('6 months (product)');
  });

  test('FLOOR RULE: the same 6-month product sold to a MEMBER still keeps the full 6 months, not shortened to the member base', async () => {
    const sale = await createSaleViaApi(page, {
      memberId, paymentMethod: 'CASH', amountTendered: 90,
      lines: [{ productId: sixMonthProductId, quantity: 1, unitPrice: 90 }],
    });
    expect(sale.saleNumber).toBeTruthy();

    const warranty = await latestWarrantyFor(sixMonthProductName);
    expect(warranty.durationSource).toBe('PRODUCT_MONTHS');
    expect(warranty.months).toBe(6);
    expect(warranty.coverageLabel).toBe('6 months (product)');
  });
});
