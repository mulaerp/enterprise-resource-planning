import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import shopApi from '../lib/shop-api';

interface ShopCustomer {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  memberId: string | null;
  emailVerified: boolean;
  status: string;
}

interface ShopAuthContextType {
  customer: ShopCustomer | null;
  loading: boolean;
  register: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const ShopAuthContext = createContext<ShopAuthContextType | undefined>(undefined);

/**
 * Session provider for the storefront's customer account area. Entirely separate from the
 * staff `AuthContext` - reads `GET /shop/auth/me` (the MULAERP_SHOP cookie), never the staff
 * `/auth/me`, and never redirects an anonymous shopper anywhere: browsing the storefront must
 * keep working with no session at all (see the SHOP module spec - "guests must never be pushed
 * to a login wall").
 */
export function ShopAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomer = async () => {
    try {
      const response = await shopApi.get('/shop/auth/me');
      setCustomer(response.data);
    } catch {
      // Any failure (401 = no session, network error, etc.) just means "not signed in" for an
      // anonymous storefront visitor - never surfaced as an error, never redirected.
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Session restoration: the JWT lives in an httpOnly cookie we can't read from JS, so the
    // only way to know if a shop session exists is to ask the server.
    fetchCustomer();
  }, []);

  const register = async (email: string, password: string, fullName: string, phone: string) => {
    await shopApi.post('/shop/auth/register', { email, password, fullName, phone });
    // Registration alone does not sign the customer in (no cookie is set by /register) -
    // callers should follow up with login() or navigate to the login page.
  };

  const login = async (email: string, password: string) => {
    const response = await shopApi.post('/shop/auth/login', { email, password });
    setCustomer(response.data);
  };

  const logout = async () => {
    try {
      await shopApi.post('/shop/auth/logout');
    } finally {
      setCustomer(null);
    }
  };

  return (
    <ShopAuthContext.Provider
      value={{
        customer,
        loading,
        register,
        login,
        logout,
        isAuthenticated: !!customer,
      }}
    >
      {children}
    </ShopAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context+provider+hook colocated by design
export function useShopAuth() {
  const context = useContext(ShopAuthContext);
  if (context === undefined) {
    throw new Error('useShopAuth must be used within a ShopAuthProvider');
  }
  return context;
}
