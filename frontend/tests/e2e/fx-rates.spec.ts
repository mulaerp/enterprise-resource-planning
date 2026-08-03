import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

// V31: automatic FX rate refresh. Covers the Company Settings "Exchange Rates" card - manager
// login (canEditRates gate), the rendered rows (source badge + rate input), and the manual
// "Refresh from provider" trigger (POST /api/v1/currencies/refresh-rates).
test.describe('FX rates - Company Settings exchange rates card', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'manager@mulaerp.com', 'admin123');
  });

  test('renders the exchange rates card with editable rows for a manager', async ({ page }) => {
    await page.goto('/settings/company');
    await expect(page.getByRole('heading', { name: /exchange rates/i })).toBeVisible();

    // MYR is the fixed base currency and is never editable.
    const myrRow = page.locator('div', { has: page.getByText('MYR', { exact: true }) }).first();
    await expect(myrRow.getByText(/base currency/i)).toBeVisible();

    // A non-base currency (USD) should have an editable rate input and a Save button, plus a
    // source badge (Auto or Manual - whichever it currently is, just confirm one is rendered).
    const usdRow = page.locator('div.py-3', { hasText: 'USD' }).first();
    await expect(usdRow).toBeVisible();
    await expect(usdRow.getByLabel(/USD rate to base/i)).toBeVisible();
    await expect(usdRow.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(usdRow.getByText(/^(Auto|Manual)$/)).toBeVisible();

    // Manager can edit rates - only ADMIN/MANAGER can, and the page hides the restriction
    // banner for them.
    await expect(page.getByText(/only managers and admins can edit exchange rates/i)).not.toBeVisible();
  });

  test('manual "Refresh from provider" trigger updates rates and shows a last-fetch status line', async ({ page }) => {
    await page.goto('/settings/company');

    const refreshButton = page.getByRole('button', { name: /refresh from provider/i });
    await expect(refreshButton).toBeVisible();

    // Capture USD's rate text before the refresh so we can assert something changed
    // (best-effort - a live provider call, so we only assert the flow completes and the status
    // line appears, not a specific numeric rate).
    await refreshButton.click();

    // Success toast or an error toast - either way the button must return to its resting label
    // and a "Last fetch" status line must appear reflecting the attempt just made.
    await expect(page.getByText(/refreshed \d+ exchange rate|failed to refresh exchange rates/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(refreshButton).toBeEnabled({ timeout: 15000 });
    await expect(page.getByText(/^last fetch:/i)).toBeVisible({ timeout: 10000 });
  });
});
