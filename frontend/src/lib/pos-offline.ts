/*
 * Point of Sale offline support.
 *
 * Everything here is localStorage-only (no IndexedDB, no new deps):
 *  - a best-effort product catalogue cache so search keeps working offline
 *  - a durable queue for sales that failed to POST because of a network error
 *  - a small pub/sub layer (native events) so React components can react to
 *    queue and connectivity changes without polling
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import api from './api';

const PRODUCT_CACHE_KEY = 'pos_product_cache_v1';
const SALE_QUEUE_KEY = 'pos_sale_queue_v1';
const QUEUE_CHANGED_EVENT = 'pos-queue-changed';

export type ThriftCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface CachedProduct {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  condition?: ThriftCondition;
  tags?: string[];
  accessories?: string;
  hasBox?: boolean;
  acquisitionCost?: number;
}

export interface CreateSaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineDiscount?: number;
}

/** WP: part-exchange - one traded-in item, valued at the credit rate. */
export interface TradeInLinePayload {
  description: string;
  condition?: ThriftCondition;
  accessories?: string;
  hasBox?: boolean;
  offeredCashValue: number;
  offeredCreditValue: number;
  /** V38: an existing catalogue product this line links to (a suggest-endpoint candidate the
   * cashier picked) - when set, the backend increments that product's stock/acquisitionCost
   * instead of minting a new product. See RegisterPage's Trade-In panel. */
  productId?: string;
  /** V38: required by the backend when productId is absent - every newly-created trade-in
   * product must land in a category. */
  categoryId?: string;
}

export interface TradeInPayload {
  clientTradeInId: string;
  lines: TradeInLinePayload[];
}

export type SalePaymentMethod = 'CASH' | 'CARD' | 'EWALLET' | 'STORE_CREDIT';

export interface CreateSalePayload {
  clientSaleId: string;
  memberId?: string;
  voucherCode?: string;
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  cartDiscount?: number;
  tradeIn?: TradeInPayload;
  storeCreditRedeemed?: number;
  lines: CreateSaleLine[];
}

export interface SaleResult {
  id: string;
  saleNumber: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  change: number;
  pointsEarned: number;
  createdAt: string;
  tradeInId?: string;
  tradeInValueApplied?: number;
  storeCreditRedeemed?: number;
  netCashDirection?: 'CUSTOMER_PAYS' | 'SHOP_PAYS' | 'EVEN';
  netCashAmount?: number;
}

export interface QueuedSale {
  clientSaleId: string;
  payload: CreateSalePayload;
  queuedAt: string;
}

// ---------------------------------------------------------------------------
// Product catalogue cache
// ---------------------------------------------------------------------------

export function cacheProducts(products: CachedProduct[]): void {
  if (!products.length) return;
  const existing = getCachedProducts();
  const merged = new Map(existing.map((p) => [p.id, p]));
  products.forEach((p) => merged.set(p.id, p));
  try {
    localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(Array.from(merged.values())));
  } catch {
    // Storage unavailable/full - cache is best-effort, safe to ignore.
  }
}

export function getCachedProducts(): CachedProduct[] {
  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedProduct[]) : [];
  } catch {
    return [];
  }
}

export function searchCachedProducts(query: string): CachedProduct[] {
  const q = query.trim().toLowerCase();
  const all = getCachedProducts();
  if (!q) return all.slice(0, 10);
  return all
    .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Sale queue
// ---------------------------------------------------------------------------

function notifyQueueChanged(): void {
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

export function getQueuedSales(): QueuedSale[] {
  try {
    const raw = localStorage.getItem(SALE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSale[]) : [];
  } catch {
    return [];
  }
}

export function getQueueCount(): number {
  return getQueuedSales().length;
}

function saveQueue(queue: QueuedSale[]): void {
  try {
    localStorage.setItem(SALE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
  notifyQueueChanged();
}

function queueSale(payload: CreateSalePayload): void {
  const queue = getQueuedSales();
  queue.push({ clientSaleId: payload.clientSaleId, payload, queuedAt: new Date().toISOString() });
  saveQueue(queue);
}

function removeSaleFromQueue(clientSaleId: string): void {
  saveQueue(getQueuedSales().filter((q) => q.clientSaleId !== clientSaleId));
}

export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

/**
 * Submit a sale. If the request fails because the device is offline (no
 * response from the server), the sale is queued in localStorage instead of
 * throwing, keyed by its client-generated clientSaleId so a later retry is
 * idempotent on the backend.
 */
export async function submitSale(
  payload: CreateSalePayload
): Promise<{ sale: SaleResult | null; queued: boolean }> {
  try {
    const response = await api.post<SaleResult>('/pos/sales', payload);
    return { sale: response.data, queued: false };
  } catch (err) {
    if (isNetworkError(err)) {
      queueSale(payload);
      return { sale: null, queued: true };
    }
    throw err;
  }
}

export interface FlushResult {
  clientSaleId: string;
  success: boolean;
  sale?: SaleResult;
}

/**
 * Retry every queued sale in order. Safe to call repeatedly - clientSaleId
 * makes each POST idempotent on the backend. Stops as soon as a network
 * error is hit again (still offline); a server-rejected sale is dropped
 * from the queue so it cannot get stuck forever, and reported as a failure.
 */
export async function flushQueue(onResult?: (result: FlushResult) => void): Promise<void> {
  for (const item of getQueuedSales()) {
    try {
      const response = await api.post<SaleResult>('/pos/sales', item.payload);
      removeSaleFromQueue(item.clientSaleId);
      onResult?.({ clientSaleId: item.clientSaleId, success: true, sale: response.data });
    } catch (err) {
      if (isNetworkError(err)) {
        break;
      }
      removeSaleFromQueue(item.clientSaleId);
      onResult?.({ clientSaleId: item.clientSaleId, success: false });
    }
  }
}

// ---------------------------------------------------------------------------
// React hook: connectivity + queue status, with auto-flush on reconnect
// ---------------------------------------------------------------------------

export function useSalesQueue(onSynced?: (sale: SaleResult) => void) {
  const [online, setOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(() => getQueueCount());
  const flushingRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;
  // React StrictMode (dev only) double-invokes this effect (mount -> cleanup -> remount) on
  // first mount, so the proactive "already online with a queued sale" check below would fire
  // flushNow() twice in a row. flushingRef alone doesn't reliably prevent that: both mount
  // passes can read the queue before the first request round-trips, sending the same queued
  // sale to the backend twice - each with its own clientSaleId consumed from the queue, so
  // this isn't just a harmless idempotent replay, it's two distinct stock-decrementing sales
  // for what the user queued once (surfaced as a real "insufficient stock" 400 on the second
  // one when only one unit was left). This ref makes the proactive check a true one-shot,
  // independent of how many times the effect body itself re-runs.
  const mountFlushAttemptedRef = useRef(false);

  const flushNow = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      await flushQueue((result) => {
        if (result.success && result.sale) onSyncedRef.current?.(result.sale);
      });
    } finally {
      flushingRef.current = false;
      setQueuedCount(getQueueCount());
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      flushNow();
    };
    const handleOffline = () => setOnline(false);
    const handleQueueChanged = () => setQueuedCount(getQueueCount());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, handleQueueChanged);

    if (!mountFlushAttemptedRef.current && navigator.onLine && getQueueCount() > 0) {
      mountFlushAttemptedRef.current = true;
      flushNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, handleQueueChanged);
    };
  }, [flushNow]);

  return { online, queuedCount, flushNow };
}
