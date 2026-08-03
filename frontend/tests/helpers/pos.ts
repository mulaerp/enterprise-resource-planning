import type { Page, Locator } from '@playwright/test';

/**
 * Format a number the same way every staff-facing page does (`formatMoney`
 * in lib/money.ts, imported by RegisterPage.tsx / DisplayPage.tsx and the
 * rest of the app - see the CURRENCY module spec), so assertions can compare
 * against a computed expectation instead of a hardcoded string.
 *
 * `formatMoney(1234.5)` -> "RMÂ 1,234.50" - the space between "RM" and
 * the digits is U+00A0 (NO-BREAK SPACE), which is what
 * `Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' })`
 * produces, NOT a regular space. Kept as its own Intl call (mirroring the
 * app's formatter) rather than importing lib/money.ts directly, matching
 * this file's existing convention of mirroring app logic for e2e helpers.
 */
const MYR_FORMATTER = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
});

export function formatMoney(n: number): string {
  return MYR_FORMATTER.format(n);
}

/** Round to 2dp the same way the PoS pages do (`round2` in RegisterPage.tsx). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Locate the value that sits immediately next to a label, matching the
 * `<span>Label</span><span>Value</span>` (or `<p>`/`<p>`) sibling pattern used
 * throughout the register's cart summary, the checkout confirmation modal,
 * and the customer display (RegisterPage.tsx, DisplayPage.tsx).
 *
 * Pass a `Page` to search the whole page, or a `Locator` (e.g. from
 * `modalByTitle`) to scope the lookup - several labels such as "Total" are
 * rendered more than once at the same time (the cart summary stays in the
 * DOM underneath an open confirmation modal), so scoping is required there.
 */
export function valueAfterLabel(scope: Page | Locator, label: string): Locator {
  return scope.locator(`:text-is("${label}") + *`).first();
}

/**
 * Scope a locator to the wrapper of a `Modal` (components/ui/Modal.tsx)
 * identified by its title, so label/value lookups inside it don't collide
 * with identical labels rendered on the page behind the modal (e.g. "Total"
 * appears both in the register's cart summary and in the "Sale Complete"
 * confirmation dialog at the same time).
 */
export function modalByTitle(page: Page, title: string): Locator {
  return page.locator('h3', { hasText: title }).locator('xpath=..').locator('xpath=..');
}

/**
 * Locate a form field by its visible label text for the shared `Input` /
 * `Select` / `Textarea` components (components/ui/{Input,Select,Textarea}.tsx).
 *
 * KNOWN GAP: those components render a bare `<label>` with no `htmlFor`/`id`
 * pairing to the control (see IntakePage, MemberFormPage, VoucherFormPage),
 * so `page.getByLabel()` cannot find them there - it only works on
 * RegisterPage, which hand-rolls its inputs with proper `htmlFor`/`id`. The
 * label is always the control's immediately-preceding sibling in the DOM, so
 * this falls back to a sibling lookup instead.
 */
export function fieldByLabel(page: Page, labelText: string): Locator {
  return page
    .locator('label', { hasText: labelText })
    .locator('xpath=following-sibling::*[self::input or self::select or self::textarea][1]');
}
