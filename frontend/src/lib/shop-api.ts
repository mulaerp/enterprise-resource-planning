import axios from 'axios';

/**
 * Customer API client for the B2C storefront's authenticated account area
 * (`/shop/register`, `/shop/login`, `/shop/account`).
 *
 * Deliberately a THIRD axios instance, separate from both `lib/api.ts` (staff, MULAERP_AUTH
 * cookie) and `lib/public-api.ts` (fully anonymous, no session at all): session state here is
 * the MULAERP_SHOP httpOnly cookie set by `POST /shop/auth/login` - there is no token in JS to
 * attach, and this client must NEVER carry the staff interceptor's behaviour:
 *  - no Authorization header injection (nothing to inject; the cookie does the work)
 *  - no redirect-to-`/login` on 401 - a 401 here just means "not signed in to the shop account",
 *    which is an entirely normal state for an anonymous browser (see ShopAuthContext's own
 *    session probe) and must never bounce a guest towards the STAFF login wall.
 * Hits only the `/shop/**` backend routes.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const shopApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default shopApi;
