import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { fieldByLabel, formatMoney } from '../helpers/pos';

/**
 * Point of Sale - members and vouchers admin screens.
 * Reads directly from src/pages/pos/{MembersListPage,MemberFormPage,
 * VouchersListPage,VoucherFormPage}.tsx.
 *
 * MembersListPage paginates (size 10) and filters via its search box, so
 * every assertion below searches for the record it just created instead of
 * assuming it lands on page 0 - the suite may run against a database that
 * already has other members in it. VouchersListPage has no pagination (it
 * fetches the full list), so that risk doesn't apply there.
 */

test.describe('Point of Sale - members', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('lists members with name, tier, points and discount columns', async ({ page }) => {
    await page.goto('/pos/members');
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tier' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Points' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Discount' })).toBeVisible();
  });

  test('creates a member and sees tier/points/discount rendered in the list', async ({ page }) => {
    const timestamp = Date.now();
    const memberName = `List Test Member ${timestamp}`;
    await page.goto('/pos/members/new');
    await expect(page.getByRole('heading', { name: 'Add New Member' })).toBeVisible();
    await fieldByLabel(page, 'Name').fill(memberName);
    // Phone is a unique column - a hardcoded value collides with earlier runs against a
    // non-fresh database (the last 8 digits of the timestamp fit a plain phone-length field).
    await fieldByLabel(page, 'Phone').fill(`019${`${timestamp}`.slice(-8)}`);
    await fieldByLabel(page, 'Email').fill(`member${timestamp}@test.com`);
    await page.getByRole('button', { name: 'Create Member' }).click();
    await expect(page).toHaveURL(/\/pos\/members$/, { timeout: 10000 });

    await page.getByPlaceholder('Search by name or phone...').fill(memberName);
    const row = page.locator('tr', { hasText: memberName });
    await expect(row).toBeVisible({ timeout: 10000 });

    const cells = row.locator('td');
    await expect(cells.nth(3)).toBeVisible(); // Tier badge renders something non-empty
    await expect(cells.nth(4)).toHaveText(/^\d+$/); // Points is a plain number
    await expect(cells.nth(5)).toHaveText(/^\d+%$/); // Discount is "<n>%"
  });

  test('edits a member and sees the update reflected in the list', async ({ page }) => {
    const timestamp = Date.now();
    const memberName = `Edit Test Member ${timestamp}`;
    // Phone is a unique column - hardcoded values collide with earlier runs against a
    // non-fresh database, so both the original and the updated number are derived from
    // this run's own timestamp instead.
    const originalPhone = `011${`${timestamp}`.slice(-8)}`;
    const updatedPhone = `019${`${timestamp}`.slice(-8)}`;
    await page.goto('/pos/members/new');
    await fieldByLabel(page, 'Name').fill(memberName);
    await fieldByLabel(page, 'Phone').fill(originalPhone);
    await page.getByRole('button', { name: 'Create Member' }).click();
    await expect(page).toHaveURL(/\/pos\/members$/, { timeout: 10000 });

    await page.getByPlaceholder('Search by name or phone...').fill(memberName);
    const row = page.locator('tr', { hasText: memberName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Edit' }).click();

    await expect(page).toHaveURL(/\/pos\/members\/.+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Member' })).toBeVisible();
    const phoneField = fieldByLabel(page, 'Phone');
    await expect(phoneField).toHaveValue(originalPhone);
    await phoneField.fill(updatedPhone);
    await page.getByRole('button', { name: 'Update Member' }).click();

    await expect(page).toHaveURL(/\/pos\/members$/, { timeout: 10000 });
    await page.getByPlaceholder('Search by name or phone...').fill(memberName);
    const updatedRow = page.locator('tr', { hasText: memberName });
    await expect(updatedRow.getByText(updatedPhone)).toBeVisible({ timeout: 10000 });
  });

  test('blocks an empty member submission', async ({ page }) => {
    // Name/Phone are plain HTML `required` inputs on the shared Input
    // component, which renders no custom error text (see MemberFormPage.tsx
    // / components/ui/Input.tsx) - the browser blocks the submit natively,
    // so the only observable effect is staying on the page.
    await page.goto('/pos/members/new');
    await page.getByRole('button', { name: 'Create Member' }).click();
    await expect(page).toHaveURL(/\/pos\/members\/new$/);
    await expect(page.getByRole('heading', { name: 'Add New Member' })).toBeVisible();
  });
});

test.describe('Point of Sale - vouchers', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('lists vouchers with code, type, value, min spend, expiry and usage columns', async ({ page }) => {
    await page.goto('/pos/vouchers');
    await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Value' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Min Spend' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Expires' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Usage Limit' })).toBeVisible();
  });

  test('creates a percent voucher and sees its defaults render in the list', async ({ page }) => {
    const code = `LISTTEST${Date.now()}`;
    await page.goto('/pos/vouchers/new');
    await expect(page.getByRole('heading', { name: 'Add New Voucher' })).toBeVisible();
    await fieldByLabel(page, 'Code').fill(code);
    await fieldByLabel(page, 'Type').selectOption('PERCENT');
    await fieldByLabel(page, 'Value').fill('15');
    await page.getByRole('button', { name: 'Create Voucher' }).click();

    await expect(page).toHaveURL(/\/pos\/vouchers$/, { timeout: 10000 });
    const row = page.locator('tr', { hasText: code });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText('PERCENT')).toBeVisible();
    await expect(row.getByText('15%')).toBeVisible();
    await expect(row.getByText('-', { exact: true })).toBeVisible(); // min spend left blank
    await expect(row.getByText('Never')).toBeVisible(); // no expiry set
    await expect(row.getByText('Unlimited')).toBeVisible(); // no usage limit set
  });

  test('creates a fixed-amount voucher', async ({ page }) => {
    const code = `FIXEDTEST${Date.now()}`;
    await page.goto('/pos/vouchers/new');
    await fieldByLabel(page, 'Code').fill(code);
    await fieldByLabel(page, 'Type').selectOption('FIXED');
    await fieldByLabel(page, 'Value').fill('5');
    await page.getByRole('button', { name: 'Create Voucher' }).click();

    await expect(page).toHaveURL(/\/pos\/vouchers$/, { timeout: 10000 });
    const row = page.locator('tr', { hasText: code });
    await expect(row).toBeVisible({ timeout: 10000 });
    // exact: true - the code itself is "FIXEDTEST<timestamp>", which also contains
    // "FIXED" as a substring and would otherwise match the code cell too.
    await expect(row.getByText('FIXED', { exact: true })).toBeVisible();
    await expect(row.getByText(formatMoney(5))).toBeVisible();
  });

  test('blocks an empty voucher submission', async ({ page }) => {
    // Code/Value are plain HTML `required` inputs on the shared Input/Select
    // components, which render no custom error text (see VoucherFormPage.tsx
    // / components/ui/Input.tsx) - the browser blocks the submit natively,
    // so the only observable effect is staying on the page.
    await page.goto('/pos/vouchers/new');
    await page.getByRole('button', { name: 'Create Voucher' }).click();
    await expect(page).toHaveURL(/\/pos\/vouchers\/new$/);
    await expect(page.getByRole('heading', { name: 'Add New Voucher' })).toBeVisible();
  });
});
