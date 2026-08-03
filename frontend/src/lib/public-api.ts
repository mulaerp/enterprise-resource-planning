import axios from 'axios';

/**
 * Anonymous API client for the public storefront (`/`, `/shop/*`).
 *
 * Deliberately a separate axios instance from `lib/api.ts`: the public
 * storefront pages are rendered outside `ProtectedRoute` for anonymous
 * shoppers, so this client must NOT attach a JWT (there may not be one, and
 * an expired/invalid one shouldn't matter here) and must NOT redirect to
 * /login on a 401/403 - the shared `api` instance's response interceptor
 * does both of those, which would be actively wrong for anonymous traffic.
 * Hits only the `/public/**` backend routes (permitAll).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default publicApi;
