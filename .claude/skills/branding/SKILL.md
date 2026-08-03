---
name: branding
description: Mula ERP white-label branding — brand strings, accent theme tokens, logo/favicon slots. Use for branding, white-label, rebrand, rename app, logo, theme colour.
---

# White-label branding

Mula ERP renders every brand-specific string and the accent colour from a
single config module + a CSS token block. Every default reproduces today's
literal text/colours exactly, so an unconfigured build is unchanged.

## Where branding lives

- **`frontend/src/branding.ts`** - the `branding` object. Each field reads
  `import.meta.env.VITE_BRAND_*` and falls back to the current string:
  `appName` ("Mula ERP"), `tagline` ("Enterprise System"), `logoInitial`
  ("M"), `storeName` ("Mula Thrift Store"), `copyright` ("© 2025 Mula ERP.
  All rights reserved."), plus optional `logoUrl` / `faviconUrl`.
- Consumers: `components/Layout.tsx` (sidebar name/tagline/logo tile - or an
  `<img>` when `logoUrl` is set), `pages/auth/LoginPage.tsx` (heading
  strapline + footer), `pages/pos/DisplayPage.tsx` (PoS customer display
  welcome screen), `main.tsx` (sets `document.title = branding.appName` at
  bootstrap; `index.html`'s static `<title>` stays as the no-JS fallback).
- Backend: `mulaerp.brand.name` in `backend/src/main/resources/application.yml`
  (`${BRAND_NAME:Mula ERP}`), consumed by
  `com.mulaerp.email.service.EmailTemplateService` for email subjects/bodies.
- `compose.yaml`: `VITE_BRAND_*` passthroughs on the `frontend` service use an
  empty-string default (`${VAR:-}`) - safe because `branding.ts` uses `||`,
  which treats `""` as falsy. `BRAND_NAME` on the `backend` service instead
  defaults to the literal `Mula ERP` (`${BRAND_NAME:-Mula ERP}`) because Spring
  YAML placeholder defaults (`${BRAND_NAME:Mula ERP}`) only apply when the
  property is *absent*, not when it's present-but-empty - passing through an
  explicit empty string would blank out every email subject.
- Assets: `frontend/public/branding/README.md` documents dropping in
  `logo.svg` / `favicon.svg` and pointing `VITE_BRAND_LOGO_URL` /
  `VITE_BRAND_FAVICON_URL` at them. No binary assets are checked in.

## Accent theme tokens

`frontend/src/index.css` defines the accent scale in the Tailwind 4
`@theme` block: `--color-brand-50` … `--color-brand-900`, defaulting to
Tailwind's stock `blue` hex values (the shades this app's action/accent
elements already used). A rebrand edits these hex values directly - Tailwind
v4 `@theme` tokens are compile-time, not runtime-configurable via env vars.

Components use `bg-brand-600`, `hover:bg-brand-700`, `focus-visible:ring-brand-600`,
`text-brand-600`, etc. for **action/accent** elements: buttons, links, focus
rings, the sidebar logo tile and active nav item, form input focus states,
loading spinners, unread/emphasis indicators, money-total emphasis.

## What NOT to touch

- **Slate neutrals** (`slate-50` … `slate-900`) - surfaces/borders/text, not
  brand-related.
- **Status colours** - anywhere blue is one color in a fixed semantic or
  categorical set, it stays literal `blue-*` and must NOT be swept to
  `brand-*`, because changing the brand colour must not silently recolour an
  unrelated status:
  - `Badge.tsx` / `Toast.tsx` `info` variant (parallels `success`/`warning`/
    `danger` - a recognised info=blue convention independent of brand colour).
  - Domain status/condition/priority maps with a fixed blue entry alongside
    other fixed colours, e.g. `SalesOrderDetailPage.tsx` (`CONFIRMED`),
    `SerialListPage.tsx` (`SOLD`), `StockTransferListPage.tsx`
    (`IN_TRANSIT`), `NotificationBell.tsx` (`ORDER_STATUS` icon, default
    priority border), `GlobalSearch.tsx` (per-result-type icon colour).
  - Categorical decorative palettes mixing blue/green/amber/slate across
    module tiles or stat cards - e.g. `AccountingPage.tsx` / `InventoryPage.tsx`
    / `ReportsPage.tsx` module tiles, `DashboardPage.tsx` stat `iconBg`/
    quick-action colours, `InventoryReportPage.tsx` / `SalesReportPage.tsx`
    per-metric stat colours. These rotate through several fixed colours by
    design (like the `recharts` hex palettes) - recolouring only the blue
    entry would look inconsistent, not "on brand".
  - Recharts hex colours (`#2563eb`, `COLORS` arrays, `stroke=`/`fill=` props)
    - charts are out of scope for this sweep entirely.
  - Ad-hoc `bg-blue-50` info/notice callouts (`CompanySettingsPage.tsx`,
    `PaymentFormPage.tsx`) - treated the same as the `Badge`/`Toast` info
    semantic, not the brand accent.

If in doubt whether a given `blue-*` usage is status/categorical vs.
accent/action, check whether the surrounding code chooses between several
fixed colours for different values (status/categorical → leave blue) or
whether it's the single colour used everywhere for that kind of interactive
element (action/accent → convert to `brand-*`).

## e2e caveat

The Playwright suite (`tests/e2e/*.spec.ts`) asserts today's literal visible
strings (page headings, sidebar labels, PoS display text, etc.) and, for
anything colour-sensitive, the default Tailwind blue. Changing `VITE_BRAND_*`
env vars or the `brand-*` `@theme` hex values changes what a user sees -
**run the e2e suite with unset `VITE_BRAND_*` vars (defaults)** to keep it
green, or update the relevant spec's expected strings/colours alongside an
intentional rebrand. Don't change defaults in `branding.ts` or the `@theme`
hex values without also checking `tests/e2e/` - that directory is out of
this skill's scope to edit.
