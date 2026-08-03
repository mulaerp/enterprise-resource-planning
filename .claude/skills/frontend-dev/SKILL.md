---
name: frontend-dev
description: Mula ERP frontend conventions — design system, UI kit, page/routing patterns, API layer. Use for frontend, page, component, UI, style, design, form, react.
---

# Frontend Development

React 19 + Vite 7 + TypeScript + Tailwind 4 (`frontend/`). No hot local backend — this skill is frontend-only conventions; see `backend-dev`/`run-stack` for the rest.

## Design system

Slate surfaces (`bg-white`/`bg-slate-50` cards on `slate-200` borders) with **blue-600 as the only accent** (`bg-blue-600`, `focus-visible:ring-blue-600`) — no purple/indigo/gradients by convention. One known exception exists in the codebase: `InventoryPage.tsx`'s "Stock Movements" hub tile uses `bg-indigo-600` — a pre-existing deviation, don't treat it as precedent for new work. Sidebar (`components/Layout.tsx`) is dark `bg-slate-900`/`text-slate-300`. Tables are compact with `tabular-nums` on numeric columns (see any PoS/inventory price or quantity display). Badges use soft background + matching text + border, never solid fill (`Badge.tsx`: `bg-{color}-50 text-{color}-700 border-{color}-200`). Status colors follow semantic mapping: green=success/GOOD-ish, amber=warning, red=danger, blue=info, slate=default.

## UI kit (`frontend/src/components/ui`)

`Input`/`Select`/`Textarea` all use React's `useId()` to generate a fallback id and associate it with their `<label htmlFor>` when no `id` prop is passed — keep this when editing them; it's what makes `getByLabel()` work in Playwright specs. `Button` variants: `primary` (blue-600), `secondary` (white/bordered), `danger` (red-600), `ghost` (transparent) — plus `loading` (spinner + auto-disable) and `icon` props. `Badge`/`Modal`/`DataTable` follow the same soft-surface conventions. Icon-only buttons need `aria-label` (see `RegisterPage.tsx`'s cart qty +/- buttons) — there's no visible label otherwise for screen readers or Playwright `getByRole`.

## Page & routing conventions

All routes are declared in `frontend/src/App.tsx`, lazy-loaded (`lazy(() => import(...))`) and wrapped in `<ProtectedRoute>`. Each page wraps its content in the shared `<Layout>` component itself (not centrally in `App.tsx`). Grouped modules (accounting, inventory, oversight) use a **hub-page pattern**: a top-level route (`/accounting`, `/inventory`, `/oversight`) renders a grid of module tiles that navigate to the real sub-routes — see `AccountingPage.tsx`/`InventoryPage.tsx`/`OversightPage.tsx`. Keep markup `getByLabel`/`getByRole`-friendly: real `<label htmlFor>` (or `sr-only` label) on every input, `aria-label` on icon buttons — Playwright specs (`e2e-tests` skill) depend on this.

## API layer (`lib/api.ts`)

Axios instance, base URL `VITE_API_BASE_URL` (default `http://localhost:8080/api/v1`) — so paths used elsewhere (`api.get('/products')`) never repeat the `/api/v1` prefix. Request interceptor adds `Authorization: Bearer <token>` from `localStorage`. Response interceptor redirects to `/login` and clears the token on any 401. `downloadFile(url, params, fallbackFilename)` handles blob-based PDF/CSV exports: reads the filename from `Content-Disposition` if present, otherwise falls back, then triggers a synthetic `<a download>` click — reuse it for any new export button rather than hand-rolling blob handling.

## Forms

`react-hook-form` is the standard for page forms (~12 pages use it). `zod` is listed in `package.json` but **not actually imported anywhere in `src/`** — there's no `zodResolver` in use; validation is done via RHF's own rules/manual checks. Don't add a zod schema assuming precedent exists; there isn't one yet, but the dependency is there if you choose to introduce it.

## Toast & WebSocket

`useToast()` (`components/ui/Toast.tsx`, must be used inside `<ToastProvider>` which wraps the whole app in `App.tsx`) — `success(msg)`/`error(msg)` etc. `WebSocketContext` (`contexts/WebSocketContext.tsx`) provides the live notification/dashboard-update channel; `AuthContext` holds the authenticated user and token.
