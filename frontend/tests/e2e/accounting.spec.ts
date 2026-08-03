import { test, expect } from '@playwright/test';

test.describe('Accounting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to the accounting hub page', async ({ page }) => {
    await page.getByRole('link', { name: /accounting/i }).first().click();
    await expect(page).toHaveURL(/\/accounting$/);
    await expect(page.getByRole('heading', { name: /accounting/i })).toBeVisible();
    // Each hub card repeats its keyword in both the title and the description
    // (e.g. "Chart of Accounts" / "Manage your chart of accounts"), so these
    // resolve to more than one element — .first() just confirms presence.
    await expect(page.getByText(/chart of accounts/i).first()).toBeVisible();
    await expect(page.getByText(/journal entries/i).first()).toBeVisible();
    await expect(page.getByText(/trial balance/i).first()).toBeVisible();
  });

  test('should navigate from the hub to chart of accounts', async ({ page }) => {
    await page.goto('/accounting');
    await page.getByRole('button', { name: /chart of accounts/i }).click();
    await expect(page).toHaveURL(/\/accounting\/accounts/);
  });

  test.describe('Chart of Accounts', () => {
    test('should display accounts list shell', async ({ page }) => {
      await page.goto('/accounting/accounts');

      await expect(page.getByRole('heading', { name: /chart of accounts/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new account/i })).toBeVisible();
      await expect(page.getByText(/^code$/i)).toBeVisible();
      await expect(page.getByText(/^name$/i)).toBeVisible();
    });

    test('should navigate to create account page', async ({ page }) => {
      await page.goto('/accounting/accounts');
      await page.getByRole('button', { name: /new account/i }).click();
      await expect(page).toHaveURL(/\/accounting\/accounts\/new/);
    });

    test('should render account form fields and validate required fields', async ({ page }) => {
      await page.goto('/accounting/accounts/new');

      await expect(page.getByRole('heading', { name: /new account/i })).toBeVisible();
      await expect(page.getByLabel(/code/i)).toBeVisible();
      await expect(page.getByLabel(/^name/i)).toBeVisible();
      await expect(page.getByLabel(/account type/i)).toBeVisible();

      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test('should create a new account', async ({ page }) => {
      const timestamp = Date.now();

      await page.goto('/accounting/accounts/new');
      await page.getByLabel(/code/i).fill(`${timestamp}`.slice(-6));
      await page.getByLabel(/^name/i).fill(`Test Account ${timestamp}`);
      await page.getByLabel(/account type/i).selectOption('ASSET');

      await page.getByRole('button', { name: /^save$/i }).click();

      await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/accounting\/accounts$/);
    });
  });

  test.describe('Journal Entries', () => {
    test('should display journal entries list shell', async ({ page }) => {
      await page.goto('/accounting/journal-entries');

      await expect(page.getByRole('heading', { name: /journal entries/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new entry/i })).toBeVisible();
      await expect(page.getByText(/entry #/i)).toBeVisible();
      await expect(page.getByText(/description/i).first()).toBeVisible();
    });

    test('should navigate to create journal entry page', async ({ page }) => {
      await page.goto('/accounting/journal-entries');
      await page.getByRole('button', { name: /new entry/i }).click();
      await expect(page).toHaveURL(/\/accounting\/journal-entries\/new/);
    });

    test('should render journal entry form with two default lines', async ({ page }) => {
      await page.goto('/accounting/journal-entries/new');

      await expect(page.getByRole('heading', { name: /new journal entry/i })).toBeVisible();
      await expect(page.getByLabel(/^date/i)).toBeVisible();
      await expect(page.getByLabel(/description/i).first()).toBeVisible();
      await expect(page.getByText(/^lines$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /add line/i })).toBeVisible();
      // Two default lines are seeded, each with an account select
      await expect(page.locator('table select')).toHaveCount(2);
    });

    test('should reject an unbalanced journal entry on submit', async ({ page }) => {
      await page.goto('/accounting/journal-entries/new');

      await page.getByLabel(/description/i).first().fill('Unbalanced test entry');
      const debitInputs = page.locator('table input[placeholder="0.00"]');
      // First row: debit 100, second row: credit 50 -> out of balance
      await debitInputs.nth(0).fill('100');
      await debitInputs.nth(3).fill('50');

      await page.getByRole('button', { name: /^save$/i }).click();

      await expect(page.getByText(/balanced/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('should create a balanced journal entry', async ({ page }) => {
      const timestamp = Date.now();
      const debitCode = `${timestamp}`.slice(-6);
      const creditCode = `${debitCode}1`;

      // Create two accounts via the UI (cheap precondition for the journal lines)
      await page.goto('/accounting/accounts/new');
      await page.getByLabel(/code/i).fill(debitCode);
      await page.getByLabel(/^name/i).fill(`Debit Account ${timestamp}`);
      await page.getByLabel(/account type/i).selectOption('ASSET');
      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

      await page.goto('/accounting/accounts/new');
      await page.getByLabel(/code/i).fill(creditCode);
      await page.getByLabel(/^name/i).fill(`Credit Account ${timestamp}`);
      await page.getByLabel(/account type/i).selectOption('REVENUE');
      await page.getByRole('button', { name: /^save$/i }).click();
      await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

      await page.goto('/accounting/journal-entries/new');
      const accountSelects = page.locator('table select');
      const accountOptionCount = await accountSelects.first().locator('option').count();
      test.skip(accountOptionCount <= 1, 'No accounts available to select');

      await page.getByLabel(/description/i).first().fill(`Balanced entry ${timestamp}`);
      await accountSelects.nth(0).selectOption({ label: `${debitCode} - Debit Account ${timestamp}` });
      await accountSelects.nth(1).selectOption({ label: `${creditCode} - Credit Account ${timestamp}` });

      const amountInputs = page.locator('table input[placeholder="0.00"]');
      await amountInputs.nth(0).fill('100'); // row 1 debit
      await amountInputs.nth(3).fill('100'); // row 2 credit

      await page.getByRole('button', { name: /^save$/i }).click();

      await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/\/accounting\/journal-entries$/);
    });
  });

  test.describe('Trial Balance', () => {
    test('should display trial balance page shell', async ({ page }) => {
      await page.goto('/accounting/trial-balance');

      await expect(page.getByRole('heading', { name: /trial balance/i })).toBeVisible();
      await expect(page.getByText(/account code/i)).toBeVisible();
      await expect(page.getByText(/account name/i)).toBeVisible();
      await expect(page.getByText(/^total$/i)).toBeVisible();
    });
  });
});
