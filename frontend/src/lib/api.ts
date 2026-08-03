import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Auth is httpOnly-cookie based (MULAERP_AUTH, set by POST /auth/login - see AuthContext).
// The frontend never reads or stores the JWT itself, so there's no Authorization header to
// inject here. `withCredentials` isn't needed either: frontend and API are served same-origin
// through the Vite proxy in dev (and are intended to sit behind one reverse-proxy origin in
// test/prod - see README "Deploying beyond localhost"), so the browser attaches the cookie to
// every request automatically without any cross-origin credentials opt-in.
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 from the login endpoint itself just means "wrong credentials" - that's
    // an expected, inline-displayable error, not an expired session. Force-redirecting
    // here (as we do for every other 401) would hard-navigate back to /login before
    // LoginPage's catch block can render the message, so the user never sees why their
    // attempt failed.
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    // /auth/me is the session probe AuthContext fires on every mount (the httpOnly
    // cookie can't be read from JS, so asking the server is the only way to know if
    // a session exists). A 401 there just means "anonymous visitor" - redirecting
    // would bounce the public storefront to /login and reload-loop the login page.
    const isSessionProbe = error.config?.url?.includes('/auth/me');
    if (error.response?.status === 401 && !isLoginRequest && !isSessionProbe) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Downloads a file (PDF/CSV export) from an authed API endpoint and saves it via the browser's
 * download flow (blob -> object URL -> synthetic <a> click). Used by the WP5 report/accounting/
 * invoice export buttons.
 *
 * The filename is taken from the response's Content-Disposition header when the backend sends
 * one (all WP5 export endpoints do), falling back to `fallbackFilename` otherwise.
 */
export async function downloadFile(
  url: string,
  params: Record<string, string | number | undefined> = {},
  fallbackFilename = 'download'
): Promise<void> {
  const response = await api.get(url, { params, responseType: 'blob' });

  const disposition: string | undefined = response.headers['content-disposition'];
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  const contentType = response.headers['content-type'] || 'application/octet-stream';
  const blob = new Blob([response.data], { type: contentType });
  const objectUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

/**
 * Extracts a human-readable message from an API error, preferring the backend's
 * `error.response.data.message` (axios error shape) and falling back to `fallback`
 * when the error isn't a recognisable axios error or carries no message.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

export default api;
