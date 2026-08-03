import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (isRetry = false) => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      setLoading(false);
    } catch (err) {
      // A 429 (rate-limited) means we don't know whether the session is valid - it means
      // "try again shortly", not "you're logged out". Retrying once after a short delay
      // lets a transient rate-limit window pass without forcing a spurious logout; only an
      // actual auth rejection (401/403), or a 429 that's still happening after the retry,
      // clears the session.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && !isRetry) {
        setTimeout(() => fetchUser(true), 1500);
        return;
      }
      if (status === 401 || status === 403) {
        setUser(null);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    // Session restoration: the JWT lives in an httpOnly cookie we can't read from JS, so the
    // only way to know if a session exists is to ask the server - GET /auth/me is
    // cookie-authenticated and returns 401 if there's no valid cookie.
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    // The server sets the httpOnly MULAERP_AUTH cookie on success; we only need the user from
    // the response body. (The body also includes `token`, kept for API/curl clients - see
    // README - but the browser client has no use for it.)
    const response = await api.post('/auth/login', { email, password });
    setUser(response.data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context+provider+hook colocated by design
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
