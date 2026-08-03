package com.mulaerp.shop.payment;

/**
 * Provider-agnostic online payment gateway interface (WEBSHOP owner decision 1: online orders are
 * PAY AT COLLECTION / ON DELIVERY today, with this dormant scaffold ready for a real provider -
 * Stripe, Fiuu, or Billplz - to be plugged in later without touching {@code ShopOrderService} or
 * any controller).
 *
 * <p>The single bean of this type wired into the application is chosen by
 * {@code payment.gateway.enabled}:
 * <ul>
 *   <li>{@code false} (default) - {@link NoopGateway}. No HTTP client is constructed, no outbound
 *   call is ever made, and every method throws {@link UnsupportedOperationException} if somehow
 *   invoked (defence in depth - {@code ShopOrderService}/{@code GatewayWebhookController} check
 *   the flag themselves before ever calling in, so this should be unreachable in practice).</li>
 *   <li>{@code true} - a real implementation registered as a {@code @Component} conditional on
 *   the same property (see the checklist below for what that implementation must do).</li>
 * </ul>
 *
 * <h2>What a future integrator must implement</h2>
 * <ol>
 *   <li>A new {@code @Component} implementing this interface, {@code @ConditionalOnProperty(prefix
 *   = "payment.gateway", name = "enabled", havingValue = "true")} so it only replaces
 *   {@link NoopGateway} when explicitly turned on.</li>
 *   <li>{@link #createCheckout} - call the provider's hosted-checkout/bill-creation API using
 *   {@link PaymentGatewayProperties#getApiKey()} (never log it, never return it to the client),
 *   passing {@link PaymentGatewayProperties#getReturnUrl()} as the redirect-back URL. Return a
 *   {@link PaymentIntentResult} with the provider's own reference and the URL to redirect the
 *   customer to. The calling order's status moves {@code RESERVED -&gt; AWAITING_PAYMENT} at this
 *   point (not implemented yet - see {@code ShopOrderService} javadoc on the current
 *   PAY_AT_COLLECTION-only flow).</li>
 *   <li>{@link #verifyWebhook} - verify the provider's webhook signature using
 *   {@link PaymentGatewayProperties#getWebhookSecret()} (HMAC or provider-specific scheme - see
 *   that provider's docs) BEFORE trusting anything in the payload. Never accept an unsigned or
 *   badly-signed webhook.</li>
 *   <li>Wire a real controller method (replacing {@code GatewayWebhookController}'s 501 stub) that
 *   calls {@code verifyWebhook}, resolves the order from the payload's reference, and transitions
 *   {@code AWAITING_PAYMENT -&gt; PAID} - never {@code FULFILLED} directly; fulfilment still
 *   requires a staff handover/shipment action.</li>
 *   <li>No card data of any kind may ever reach this backend or its logs - every provider above
 *   is a hosted-checkout/redirect model precisely so that stays true.</li>
 * </ol>
 */
public interface PaymentGateway {

    /** Which provider this implementation talks to - "none" for {@link NoopGateway}. */
    String providerName();

    /** Starts a hosted checkout for one order. Never called while the gateway is disabled - see
     * class javadoc. */
    PaymentIntentResult createCheckout(CreateCheckoutRequest request);

    /** Verifies an inbound webhook's signature against the configured webhook secret. Must
     * return false (never throw) for a payload that fails verification - the caller treats
     * false as "reject the webhook", not as an error to propagate. */
    boolean verifyWebhook(String payload, String signature);
}
