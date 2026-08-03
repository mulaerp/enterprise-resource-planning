/**
 * Storefront checkout config that mirrors backend flags the public API does not (yet) expose at
 * runtime.
 *
 * KNOWN GAP (documented, not hidden): `payment.gateway.enabled` (see
 * `backend/src/main/resources/application.yml` and `com.mulaerp.shop.payment.PaymentGatewayProperties`)
 * has no public/anonymous endpoint returning its live value - every `/api/v1/public/**` and
 * `/api/v1/shop/**` response shape was read end-to-end for this task (catalogue, orders, quotes,
 * gateway webhook stub) and none carries it. This file's WEBSHOP frontend task explicitly said
 * "Do NOT touch backend", so rather than add a config endpoint, `VITE_PAYMENT_GATEWAY_ENABLED`
 * mirrors the backend's own `PAYMENT_GATEWAY_ENABLED` env var by name/default (both default to
 * "false") - set them to the same value at deploy time and the two stay in sync. This is a
 * build-time mirror, not a live read of the backend's actual config, so a change to one without
 * the other will visibly disagree until the next frontend build - see the WEBSHOP frontend
 * report for the one-line backend addition (a `GET /api/v1/public/shop/config` endpoint) that
 * would let CheckoutPage read this live instead.
 *
 * Either way, the gateway option is ALWAYS non-selectable today regardless of this flag:
 * `PlaceShopOrderRequest` has no payment-method field at all - `ShopOrderService#placeOrder`
 * always forces `PAY_AT_COLLECTION` server-side (owner decision 1) - so this only ever changes
 * the checkout page's copy ("coming soon" vs a neutral "not available for checkout yet"), never
 * what gets submitted.
 */
export const PAYMENT_GATEWAY_ENABLED = String(import.meta.env.VITE_PAYMENT_GATEWAY_ENABLED).toLowerCase() === 'true';
