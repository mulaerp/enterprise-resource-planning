package com.mulaerp.shop.payment;

import java.math.BigDecimal;

/**
 * What a future real {@link PaymentGateway} implementation needs to start a hosted checkout for
 * one {@code ShopOrder}. Deliberately carries no card data of any kind - a real provider
 * implementation redirects the customer to a provider-hosted page (Stripe Checkout, Fiuu's
 * hosted payment page, Billplz's bill page, ...) and only ever receives a webhook back; this
 * backend never touches a card number.
 */
public record CreateCheckoutRequest(String orderNumber, BigDecimal amount, String currency, String returnUrl) {
}
