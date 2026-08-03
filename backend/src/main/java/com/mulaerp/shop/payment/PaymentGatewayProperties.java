package com.mulaerp.shop.payment;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Config placeholders for a future real payment gateway (Stripe/Fiuu/Billplz) - see
 * {@code application.yml}'s {@code payment.gateway.*} keys and {@link PaymentGateway}'s class
 * javadoc for the full integrator checklist. None of these have a real value today; {@link
 * #apiKey}/{@link #webhookSecret} are never logged and, per org policy, must be supplied via
 * 1Password-backed env vars in any real deployment, never committed.
 */
@Component
@ConfigurationProperties(prefix = "payment.gateway")
@Getter
@Setter
public class PaymentGatewayProperties {

    /** Master switch - false (default) means NoopGateway is the active bean and every online
     * order is PAY_AT_COLLECTION (owner decision 1). */
    private boolean enabled = false;

    /** "none" (default), or "stripe"/"fiuu"/"billplz" once a real implementation is wired in. */
    private String provider = "none";

    /** Provider API key/secret - placeholder only; never committed, inject via 1Password/env. */
    private String apiKey = "";

    /** Shared secret used to verify inbound webhook signatures - placeholder only. */
    private String webhookSecret = "";

    /** Where the provider redirects the customer back to after a hosted checkout. */
    private String returnUrl = "http://localhost:5173/shop/checkout/return";
}
