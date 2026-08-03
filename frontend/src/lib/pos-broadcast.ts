/*
 * Live sync between the Register tab and the customer-facing Display tab.
 *
 * Primary transport: BroadcastChannel (same-origin, all modern browsers).
 * Fallback: a localStorage write + the 'storage' event, which fires in
 * other tabs whenever the key changes - useful if BroadcastChannel is ever
 * unavailable, and gives a newly-opened Display tab a last-known snapshot.
 */

const CHANNEL_NAME = 'pos-display';
const STORAGE_KEY = 'pos_display_last_message';

export interface DisplayCartLine {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Same CUSTOMER_PAYS/SHOP_PAYS/EVEN semantics as the sale response's netCashDirection - see
 * PosSaleService. SHOP_PAYS means the trade-in value (net of any store credit redeemed) exceeded
 * what was owed, so the shop owes the customer cash. */
export type NetCashDirection = 'CUSTOMER_PAYS' | 'SHOP_PAYS' | 'EVEN';

export type DisplayMessage =
  | {
      type: 'cart-update';
      lines: DisplayCartLine[];
      subtotal: number;
      memberDiscount: number;
      voucherDiscount: number;
      /** BUGFIX: trade-in value applied and store credit redeemed - without these a trade-in-only
       * session (no cart lines) never leaves the display's idle screen, and a part-exchange sale
       * never shows its net effect. See RegisterPage's broadcast effect. */
      tradeInValue: number;
      storeCreditRedeemed: number;
      total: number;
      netCashDirection: NetCashDirection;
      netCashAmount: number;
    }
  | {
      type: 'checkout';
      total: number;
      amountTendered?: number;
      change?: number;
    }
  | { type: 'reset' };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastToDisplay(message: DisplayMessage): void {
  getChannel()?.postMessage(message);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...message, _ts: Date.now() }));
  } catch {
    // best-effort fallback only
  }
}

/** Read the last broadcast message, if any - lets a freshly opened Display tab catch up. */
export function getLastDisplayMessage(): DisplayMessage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DisplayMessage) : null;
  } catch {
    return null;
  }
}

export function subscribeToDisplay(onMessage: (message: DisplayMessage) => void): () => void {
  const ch = getChannel();
  const handleChannelMessage = (event: MessageEvent<DisplayMessage>) => onMessage(event.data);
  ch?.addEventListener('message', handleChannelMessage);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        onMessage(JSON.parse(event.newValue) as DisplayMessage);
      } catch {
        // ignore malformed payloads
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    ch?.removeEventListener('message', handleChannelMessage);
    window.removeEventListener('storage', handleStorage);
  };
}
