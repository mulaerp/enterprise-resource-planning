import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'mulaerp_shop_cart_v1';

export interface CartLine {
  /** Product's real UUID id (from `PublicProductDto.id`) - required by
   * `POST /api/v1/public/shop/orders` / `/api/v1/shop/orders`
   * (`ShopOrderLineRequest.productId`, `@NotNull UUID`, no sku fallback). */
  productId: string;
  sku: string;
  name: string;
  /** MYR unit price at the moment this line was added - re-validated (and re-priced from the
   * live product record) server-side at checkout, so a stale cached price here never under- or
   * over-charges; it's display-only until the order is placed. */
  unitPrice: number;
  quantity: number;
  imageUrl?: string | null;
  /** Last-known stock status when this line was added/updated - display-only staleness hint
   * (see CartPage's "stock may have changed" note); the backend's own 409 on checkout is the
   * real authority (most thrift stock is quantity 1, so a second shopper can still win the
   * race between two people adding the same one-off item to their carts). */
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

interface CartContextType {
  lines: CartLine[];
  /** Adds `quantity` of a product to the cart, or increments the existing line by that amount
   * if already present. */
  addItem: (item: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  subtotal: number;
  /** Total unit count across all lines (badge count in PublicLayout's cart icon). */
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function loadFromStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt/foreign localStorage content - start from an empty cart rather than throwing.
    return [];
  }
}

/**
 * Client-side shopping cart for the public storefront - localStorage-backed (survives a reload,
 * never sent anywhere until checkout), never a server session. See `CheckoutPage` for how a cart
 * becomes a real `POST /api/v1/public/shop/orders` (guest) or `POST /api/v1/shop/orders` (member)
 * call - this context only ever holds client-side line items, never talks to the backend itself.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => loadFromStorage());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const addItem: CartContextType['addItem'] = (item, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === item.productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === item.productId
            ? { ...l, quantity: l.quantity + quantity, stockStatus: item.stockStatus ?? l.stockStatus }
            : l
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) {
        return prev.filter((l) => l.productId !== productId);
      }
      return prev.map((l) => (l.productId === productId ? { ...l, quantity } : l));
    });
  };

  const removeItem = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const clear = () => setLines([]);

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <CartContext.Provider value={{ lines, addItem, updateQuantity, removeItem, clear, subtotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context+provider+hook colocated by design
export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
