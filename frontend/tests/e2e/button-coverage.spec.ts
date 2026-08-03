import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';
import { sweepPageButtons } from '../helpers/button-sweep';

/**
 * Systematic dead-button sweep across the main pages of the app. One test per
 * route (per the task's parallelism requirement). Each test clicks up to the
 * first 15 non-data-row, enabled buttons on the page and asserts each produced
 * some observable effect - see helpers/button-sweep.ts for exactly what counts
 * and its known false-positive class (no-op Reset-style buttons).
 */
const ROUTES: Array<{ label: string; path: string }> = [
  { label: 'dashboard', path: '/dashboard' },
  { label: 'products', path: '/products' },
  { label: 'customers', path: '/customers' },
  { label: 'suppliers', path: '/suppliers' },
  { label: 'sales orders', path: '/sales-orders' },
  { label: 'purchase orders', path: '/purchase-orders' },
  { label: 'invoices', path: '/invoices' },
  { label: 'payments', path: '/payments' },
  { label: 'accounting hub', path: '/accounting' },
  { label: 'reports hub', path: '/reports' },
  { label: 'inventory hub', path: '/inventory' },
  { label: 'pos', path: '/pos' },
  { label: 'members', path: '/pos/members' },
  { label: 'vouchers', path: '/pos/vouchers' },
  { label: 'settings', path: '/settings/company' },
];

test.describe('Button coverage sweep', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of ROUTES) {
    test(`every enabled button on ${route.label} (${route.path}) is wired to something`, async ({ page }) => {
      const deadButtons = await sweepPageButtons(page, route.path);

      if (deadButtons.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[button-coverage] Dead buttons on ${route.path}: ${deadButtons.join(', ')}`);
      }

      // Individual dead buttons already failed as soft assertions inside the
      // sweep (each one is reported); this final check just makes the overall
      // pass/fail state explicit and lists every offender in one place.
      expect(deadButtons, `Dead buttons on ${route.path}`).toEqual([]);
    });
  }
});
