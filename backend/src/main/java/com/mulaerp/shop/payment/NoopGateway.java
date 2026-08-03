package com.mulaerp.shop.payment;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The only {@link PaymentGateway} bean while {@code payment.gateway.enabled=false} (the default -
 * see class javadoc on {@link PaymentGateway}). Constructs no HTTP client, makes no outbound call
 * ever, and every method throws {@link UnsupportedOperationException} - callers
 * ({@code ShopOrderService}, {@code GatewayWebhookController}) are expected to check
 * {@link PaymentGatewayProperties#isEnabled()} themselves before calling in, so reaching this
 * implementation's method bodies at all indicates a bug upstream, not a normal "gateway
 * unavailable" condition.
 */
@Component
@ConditionalOnProperty(prefix = "payment.gateway", name = "enabled", havingValue = "false", matchIfMissing = true)
public class NoopGateway implements PaymentGateway {

    @Override
    public String providerName() {
        return "none";
    }

    @Override
    public PaymentIntentResult createCheckout(CreateCheckoutRequest request) {
        throw new UnsupportedOperationException(
                "Payment gateway is disabled (payment.gateway.enabled=false) - online orders are PAY_AT_COLLECTION only");
    }

    @Override
    public boolean verifyWebhook(String payload, String signature) {
        throw new UnsupportedOperationException(
                "Payment gateway is disabled (payment.gateway.enabled=false) - no webhook path is reachable");
    }
}
