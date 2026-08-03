package com.mulaerp.common.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mulaerp.common.config.RateLimitConfig;
import com.mulaerp.common.exception.GlobalExceptionHandler.ErrorResponse;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Rate Limiting Filter
 * Phase 5.2: Security Hardening
 *
 * <p>WP11: narrowed to the auth endpoints only (see {@link #shouldNotFilter}), keyed on the
 * direct socket address rather than the spoofable {@code X-Forwarded-For} header unless a
 * trusted proxy says otherwise (see {@link RateLimitConfig} for the full rationale), and now
 * responds with the same {@code {timestamp, status, error, message, path}} JSON shape as the
 * rest of the API instead of a bare text body.
 *
 * <p>WP-deploy-hardening: also throttles {@code /api/v1/public/**} (the storefront catalogue and
 * warranty lookup), on a separate, much looser bucket - see {@link RateLimitConfig} for the two
 * buckets' sizing and headroom math. Runs at {@link Order} 1, before
 * {@link LoginLockoutFilter} (order 2): an IP that's already over its login-bucket budget gets
 * 429'd here without ever reaching the per-account lockout check.
 */
@Component
@RequiredArgsConstructor
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String AUTH_PATH_PREFIX = "/api/v1/auth";
    private static final String PUBLIC_PATH_PREFIX = "/api/v1/public";

    // /auth/me is a session-check (requires an already-valid signed JWT to succeed at all), not
    // a credential-guessing target like /auth/login - there is nothing to brute-force here. It's
    // also called on every single page load (AuthContext's mount-time fetchUser()), so sharing
    // the login bucket with it means routine navigation - not any actual brute-force attempt -
    // exhausts the budget: a real user (or an e2e run doing many full-page reloads) gets 429'd
    // on /auth/me, which the frontend was treating as an invalid session and force-logging out.
    // See also AuthContext.fetchUser(), fixed alongside this to stop conflating 429 with 401.
    private static final String EXEMPT_PATH = "/api/v1/auth/me";

    private final RateLimitConfig rateLimitConfig;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Login brute-force and unthrottled public-endpoint scraping are the real local threats
        // (Phase 5.2 originally throttled every request on the API, including normal
        // authenticated traffic - that was incidental over-reach, not a deliberate choice).
        // Everything outside /api/v1/auth/** and /api/v1/public/** is exempt, plus /auth/me
        // specifically (see EXEMPT_PATH javadoc).
        String uri = request.getRequestURI();
        boolean isAuth = uri.startsWith(AUTH_PATH_PREFIX) && !uri.equals(EXEMPT_PATH);
        boolean isPublic = uri.startsWith(PUBLIC_PATH_PREFIX);
        return !(isAuth || isPublic);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();
        String ip = getClientIP(request);
        boolean isPublic = uri.startsWith(PUBLIC_PATH_PREFIX);
        Bucket bucket = isPublic ? rateLimitConfig.resolvePublicBucket(ip) : rateLimitConfig.resolveLoginBucket(ip);
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            response.addHeader("X-Rate-Limit-Remaining", String.valueOf(probe.getRemainingTokens()));
            filterChain.doFilter(request, response);
        } else {
            long waitForRefillSeconds = probe.getNanosToWaitForRefill() / 1_000_000_000;
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.addHeader("X-Rate-Limit-Retry-After-Seconds", String.valueOf(waitForRefillSeconds));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);

            ErrorResponse error = new ErrorResponse(
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                    "Too many requests - please try again in " + waitForRefillSeconds + " seconds",
                    request.getRequestURI()
            );
            response.getWriter().write(objectMapper.writeValueAsString(error));
        }
    }

    // Trusts X-Forwarded-For ONLY when the direct socket peer is a configured trusted proxy (see
    // RateLimitConfig#isTrustedProxy) - empty config (the default, e.g. local/no-proxy) means
    // this always falls through to the direct remote address, exactly today's safe behaviour.
    // With no trusted proxy configured, X-Forwarded-For is attacker-supplied and trivially
    // spoofable - trusting it unconditionally would let a client bypass the limit (or frame
    // another IP) by sending an arbitrary header value.
    private String getClientIP(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (rateLimitConfig.isTrustedProxy(remoteAddr)) {
            String forwardedFor = request.getHeader("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isBlank()) {
                return forwardedFor.split(",")[0].trim();
            }
        }
        return remoteAddr;
    }
}
