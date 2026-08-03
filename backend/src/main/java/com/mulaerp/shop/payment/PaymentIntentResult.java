package com.mulaerp.shop.payment;

/**
 * What a {@link PaymentGateway#createCheckout} call returns. {@code status} is a small fixed set
 * a caller can branch on without knowing the underlying provider's own status vocabulary -
 * {@code REDIRECT} (customer must be sent to {@code checkoutUrl}), {@code REQUIRES_ACTION}
 * (e.g. 3DS - provider-specific handling needed, out of scope for the scaffold), or
 * {@code FAILED}.
 *
 * <p>A future real implementation (Stripe/Fiuu/Billplz) maps its own response shape onto this one
 * record - see {@link PaymentGateway}'s class javadoc for the full integration checklist.
 */
public record PaymentIntentResult(String providerReference, String checkoutUrl, Status status) {

    public enum Status {
        REDIRECT, REQUIRES_ACTION, FAILED
    }
}
