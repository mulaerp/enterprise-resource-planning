# Branding asset slots

Drop white-label logo/favicon assets here; nothing is committed here by default.

## Logo

1. Add `logo.svg` (or `.png`) to this folder.
2. Set `VITE_BRAND_LOGO_URL=/branding/logo.svg` in the frontend environment
   (see `compose.yaml` / `.env`).
3. `frontend/src/components/Layout.tsx` reads `branding.logoUrl` and, when
   set, renders an `<img>` in the sidebar instead of the default initial tile.

## Favicon

1. Add `favicon.svg` (or `.ico`) to this folder.
2. Set `VITE_BRAND_FAVICON_URL=/branding/favicon.svg`.
3. `frontend/index.html` ships a static fallback `<link rel="icon">`; wire an
   override at bootstrap (alongside the `document.title` assignment in
   `main.tsx`) if a given deployment needs the tab icon swapped too.

Leaving these env vars unset keeps the current Mula ERP branding untouched —
see `frontend/src/branding.ts` and `.claude/skills/branding/SKILL.md`.
