import { Page, expect, test } from '@playwright/test';

/**
 * Generic "is this button wired to anything" sweep used by button-coverage.spec.ts.
 *
 * Scope: every page is rendered through <Layout>, which puts the fixed sidebar
 * (nav links, logout, notifications, global search) in `div.fixed.inset-y-0` and
 * the page's own content in `div.ml-64`. Scoping the sweep to `div.ml-64` means
 * we never touch Logout, the notification bell, or global search - those aren't
 * "this page"'s buttons and clicking Logout mid-sweep would break every
 * subsequent assertion for the rest of the test.
 *
 * A button is considered "wired" if, within ~2s of the click, at least one of the
 * following is observed: the URL changed, a Modal opened (Modal.tsx always
 * renders its overlay as `div.fixed.inset-0.z-50` with no ARIA dialog role, so
 * that's the only reliable selector), the clicked element's aria-expanded flipped,
 * a toast appeared (`div.fixed.top-4.right-4.z-50`), or a network request fired.
 *
 * Known false-positive class (reported, not special-cased): a "Reset" button that
 * clears already-empty filters produces none of the above and will be flagged as
 * "dead" even though it's correctly wired - the heuristic can't tell "no-op
 * because nothing changed" from "no-op because unwired".
 */

const MAIN_CONTENT_SELECTOR = 'div.ml-64';
const MODAL_SELECTOR = 'div.fixed.inset-0.z-50';
const TOAST_SELECTOR = 'div.fixed.top-4.right-4.z-50';
const SKIP_NAME_PATTERN = /delete|remove/i;

export async function sweepPageButtons(page: Page, path: string, maxButtons = 15): Promise<string[]> {
  const deadButtons: string[] = [];

  await page.goto(path);
  await expect(page.locator(MAIN_CONTENT_SELECTOR)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500); // let the page's initial data fetch settle

  const main = page.locator(MAIN_CONTENT_SELECTOR);
  const candidates = main.locator('button, [role="button"]');
  const total = await candidates.count();
  const count = Math.min(total, maxButtons);

  for (let i = 0; i < count; i++) {
    const button = candidates.nth(i);

    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;

    // Skip buttons living inside a data row (table body) - per spec, row-level
    // actions (edit/delete/match/etc. on a specific record) are out of scope.
    const inDataRow = await button.evaluate((el) => !!el.closest('tbody')).catch(() => false);
    if (inDataRow) continue;

    const isDisabled = await button.isDisabled().catch(() => false);
    if (isDisabled) continue;

    const rawName = (await button.innerText().catch(() => '')).trim();
    const accessibleName = rawName || (await button.getAttribute('aria-label').catch(() => '')) || `button#${i}`;
    if (SKIP_NAME_PATTERN.test(accessibleName)) continue;

    await test.step(`click "${accessibleName}" on ${path}`, async () => {
      const urlBefore = page.url();
      const ariaBefore = await button.getAttribute('aria-expanded', { timeout: 2000 }).catch(() => null);

      const requestPromise = page
        .waitForRequest(() => true, { timeout: 2000 })
        .then(() => true)
        .catch(() => false);

      await button.click({ timeout: 5000 });
      await page.waitForTimeout(300);

      const requestFired = await requestPromise;
      const urlAfter = page.url();
      const navigated = urlAfter !== urlBefore;
      const modalVisible = await page.locator(MODAL_SELECTOR).first().isVisible().catch(() => false);
      // Skip re-querying the original button once we've navigated: `button` is a
      // by-index locator scoped to div.ml-64, and the destination page frequently has
      // fewer buttons than that index (e.g. a hub card at index 1 landing on a list
      // page with only one "New X" button at index 0). getAttribute() with no timeout
      // then waits on a locator that can never resolve, hanging until the whole TEST
      // times out - which tears down the browser mid-call and surfaces as a misleading
      // "Target page, context or browser has been closed" on the next line, not as a
      // timeout here. Navigating away is already conclusive proof the button is wired,
      // so the aria-expanded comparison is moot in that case anyway.
      const ariaAfter = navigated
        ? null
        : await button.getAttribute('aria-expanded', { timeout: 2000 }).catch(() => null);
      const ariaChanged = !navigated && ariaBefore !== null && ariaBefore !== ariaAfter;
      const toastVisible = await page.locator(TOAST_SELECTOR).first().isVisible().catch(() => false);

      const observedChange = navigated || modalVisible || ariaChanged || toastVisible || requestFired;

      if (!observedChange) {
        deadButtons.push(accessibleName);
      }

      expect
        .soft(
          observedChange,
          `Button "${accessibleName}" on ${path} produced no observable effect ` +
            '(no navigation, modal, aria-expanded change, toast, or network request within 2s)'
        )
        .toBeTruthy();

      // Reset for the next button in the sweep.
      if (modalVisible) {
        await page.keyboard.press('Escape').catch(() => {});
        await page
          .locator(MODAL_SELECTOR)
          .first()
          .waitFor({ state: 'hidden', timeout: 3000 })
          .catch(() => {});
      }
      if (navigated) {
        await page.goto(path);
        await expect(page.locator(MAIN_CONTENT_SELECTOR)).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(300);
      }
    });
  }

  return deadButtons;
}
