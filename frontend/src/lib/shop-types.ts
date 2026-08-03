/**
 * Shared response shapes for the storefront's order/trade-in-quote endpoints - mirrors the
 * backend DTOs 1:1 (`ShopOrderDto`/`ShopOrderLineDto`/`ShopTradeInQuoteDto`) so every page that
 * reads an order or a quote (checkout, confirmation, guest lookup, /shop/account) agrees on one
 * shape.
 */

export type FulfilmentType = 'COLLECT' | 'POST';

export type OrderStatus =
  | 'PENDING'
  | 'RESERVED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'READY'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'VOIDED';

export type PaymentMethod = 'PAY_AT_COLLECTION' | 'GATEWAY';

export interface ShopOrderLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ShopOrder {
  id: string;
  orderNumber: string;
  shopCustomerId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  guestPhone: string | null;
  fulfilmentType: FulfilmentType;
  deliveryAddress: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
  total: number;
  reservedUntil: string | null;
  fulfilledAt: string | null;
  storeCreditRedeemed: number;
  pointsEarned: number;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  notes: string | null;
  createdAt: string;
  lines: ShopOrderLine[];
  /** Warranty numbers auto-issued at fulfilment (Gap B) - empty until FULFILLED, or if no line's
   * product carries warrantyMonths. Check any of these at /shop/warranty (or the Warranties tab
   * on /shop/account) - the same anonymous lookup used everywhere else in the app. */
  warrantyNumbers: string[];
}

/** QUOTED|EXPIRED|RECEIVED|INSPECTED|OFFER_MADE|ACCEPTED|DECLINED|RETURNED|COMPLETED - see
 * `ShopTradeInQuote`'s class javadoc for the full transition map. */
export type QuoteStatus =
  | 'QUOTED'
  | 'EXPIRED'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'OFFER_MADE'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'RETURNED'
  | 'COMPLETED';

export interface ShopTradeInQuote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  shopCustomerId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  guestPhone: string | null;
  productId: string | null;
  productName: string | null;
  freeTextDescription: string | null;
  categoryId: string | null;
  categoryName: string | null;
  declaredCondition: string;
  hasBox: boolean | null;
  accessories: string | null;
  deliveryMethod: 'POST' | 'DROP_OFF';
  quotedMin: number;
  quotedMax: number;
  quotedAt: string;
  expiresAt: string;
  indicative: boolean;
  indicativeMessage: string;
  finalOffer: number | null;
  finalPayoutType: 'CASH' | 'STORE_CREDIT' | null;
  finalOfferOutOfRange: boolean | null;
  inspectionNotes: string | null;
  inspectedBy: string | null;
  inspectedAt: string | null;
  decidedAt: string | null;
  posTradeInId: string | null;
  createdAt: string;
  updatedAt: string;
}
