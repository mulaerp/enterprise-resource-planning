package com.mulaerp.shop.payment;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

/**
 * Stub for a future real payment-provider webhook. Lives under {@code /api/v1/public/**}
 * (permitAll, no SecurityConfig change needed - see SecurityConfig's existing
 * {@code "/api/v1/public/**"} matcher) because a real webhook call arrives unauthenticated from
 * the provider's own servers, verified instead by {@link PaymentGateway#verifyWebhook} against a
 * shared secret (see that method's javadoc) - never by a session/cookie.
 *
 * <p>Returns 501 Not Implemented whenever there is no real gateway path to reach: either the
 * gateway is disabled (the default - owner decision 1, PAY_AT_COLLECTION only) or it is enabled
 * but no real {@link PaymentGateway} provider bean has been registered yet (see that interface's
 * javadoc for the integration checklist a future PR must complete). No signature verification, no
 * order lookup, and no state change ever happens on this path today.
 */
@RestController
@RequestMapping("/api/v1/public/shop/payment")
@RequiredArgsConstructor
public class GatewayWebhookController {

    private final PaymentGatewayProperties properties;
    private final Optional<PaymentGateway> gateway;

    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> webhook(
            @RequestHeader(value = "X-Signature", required = false) String signature) {

        if (!properties.isEnabled() || gateway.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
                    "message", "Payment gateway is disabled (payment.gateway.enabled=false) - "
                            + "online orders are PAY_AT_COLLECTION only and no webhook path is reachable."
            ));
        }

        // Unreachable until a real PaymentGateway provider is wired in (see PaymentGateway's
        // class javadoc, point 4) - deliberately left as a 501 stub, not a real
        // verify-then-process implementation, to avoid processing a payload with no real
        // provider behind it.
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
                "message", "Gateway webhook processing is not yet implemented for provider: " + properties.getProvider()
        ));
    }
}
