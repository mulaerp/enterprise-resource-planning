/**
 * White-label branding config.
 *
 * Every field reads a `VITE_BRAND_*` env var (see .env / compose.yaml) and
 * falls back to Mula ERP's current strings, so an unconfigured build renders
 * byte-for-byte identical to today's UI (the e2e suite asserts these exact
 * defaults - see .claude/skills/branding/SKILL.md before changing them).
 */
export interface Branding {
  /** Product name shown in the sidebar, document title, and email subjects. */
  appName: string;
  /** Short strapline shown under the sidebar logo and on the login page. */
  tagline: string;
  /** Single-character fallback logo shown when `logoUrl` is not set. */
  logoInitial: string;
  /** Store name shown on the PoS customer-facing display. */
  storeName: string;
  /** Footer copyright line on the login page. */
  copyright: string;
  /** Optional logo image URL; when set, replaces the initial-letter tile. */
  logoUrl?: string;
  /** Optional favicon URL override (see public/branding/README.md). */
  faviconUrl?: string;
}

export const branding: Branding = {
  appName: import.meta.env.VITE_BRAND_APP_NAME || 'Mula ERP',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Enterprise System',
  logoInitial: import.meta.env.VITE_BRAND_LOGO_INITIAL || 'M',
  storeName: import.meta.env.VITE_BRAND_STORE_NAME || 'Mula Thrift Store',
  copyright: import.meta.env.VITE_BRAND_COPYRIGHT || '© 2025 Mula ERP. All rights reserved.',
  logoUrl: import.meta.env.VITE_BRAND_LOGO_URL || undefined,
  faviconUrl: import.meta.env.VITE_BRAND_FAVICON_URL || undefined,
};
