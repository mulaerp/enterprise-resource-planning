package com.mulaerp.common.filter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mulaerp.common.exception.GlobalExceptionHandler.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-account login lockout (WP-deploy-hardening item 4c).
 *
 * <p>{@link RateLimitFilter}'s login bucket is IP-keyed, which stops one source from brute-forcing
 * many accounts but does nothing to protect one specific account from a distributed/many-IP
 * guessing attempt against it. This adds a second, orthogonal control keyed on the email in the
 * login request body: {@value #MAX_CONSECUTIVE_FAILURES} consecutive failed logins for the same
 * email locks that email out for {@value #LOCK_DURATION_MINUTES} minutes, regardless of source IP.
 * A successful login resets the counter for that email.
 *
 * <p>In-memory only (a {@link ConcurrentHashMap}, same pattern as
 * {@link com.mulaerp.common.config.RateLimitConfig}) - a restart clears every lock and counter.
 * That is an accepted trade-off for this deployment (documented in README), not an oversight:
 * persisting it would need a shared store (e.g. Redis, which this stack already has via Valkey
 * for caching) which is out of scope for this hardening pass.
 *
 * <p>Runs at {@link Order} 2, after {@link RateLimitFilter} (order 1) - so a request already
 * rejected by the IP-based login bucket never reaches this filter's body-parsing/lockout logic.
 */
@Component
@RequiredArgsConstructor
@Order(2)
public class LoginLockoutFilter extends OncePerRequestFilter {

    private static final String LOGIN_PATH = "/api/v1/auth/login";
    static final int MAX_CONSECUTIVE_FAILURES = 10;
    static final int LOCK_DURATION_MINUTES = 15;
    private static final long LOCK_DURATION_MILLIS = LOCK_DURATION_MINUTES * 60_000L;

    private final ObjectMapper objectMapper;

    private final Map<String, AttemptState> attempts = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equalsIgnoreCase(request.getMethod()) && LOGIN_PATH.equals(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Buffer the body so it can be read here (to extract the email) AND again normally by
        // the downstream Jackson message converter that binds @RequestBody LoginRequest.
        byte[] body = request.getInputStream().readAllBytes();
        HttpServletRequest wrappedRequest = new CachedBodyHttpServletRequest(request, body);
        String email = extractEmail(body);

        if (email != null) {
            AttemptState state = attempts.get(email);
            if (state != null && state.isLocked()) {
                writeLockedResponse(response, request.getRequestURI(), state.remainingLockSeconds());
                return;
            }
        }

        filterChain.doFilter(wrappedRequest, response);

        if (email == null) {
            return;
        }

        if (response.getStatus() == HttpStatus.OK.value()) {
            attempts.remove(email);
        } else {
            attempts.computeIfAbsent(email, k -> new AttemptState())
                    .recordFailure(MAX_CONSECUTIVE_FAILURES, LOCK_DURATION_MILLIS);
        }
    }

    private String extractEmail(byte[] body) {
        if (body.length == 0) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(body);
            String email = node.path("email").asText(null);
            return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
        } catch (IOException e) {
            return null;
        }
    }

    private void writeLockedResponse(HttpServletResponse response, String path, long retryAfterSeconds) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.addHeader("X-Rate-Limit-Retry-After-Seconds", String.valueOf(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ErrorResponse error = new ErrorResponse(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                "Too many failed login attempts for this account - try again in " + retryAfterSeconds + " seconds",
                path
        );
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }

    /** Tracks consecutive failures and an optional lock expiry for a single email. */
    private static final class AttemptState {
        private final AtomicInteger failures = new AtomicInteger(0);
        private volatile long lockedUntilEpochMillis = 0;

        synchronized boolean isLocked() {
            return System.currentTimeMillis() < lockedUntilEpochMillis;
        }

        synchronized long remainingLockSeconds() {
            return Math.max(0, (lockedUntilEpochMillis - System.currentTimeMillis()) / 1000);
        }

        synchronized void recordFailure(int maxFailures, long lockDurationMillis) {
            if (isLocked()) {
                return; // already locked; don't extend the lock on further probing
            }
            int count = failures.incrementAndGet();
            if (count >= maxFailures) {
                lockedUntilEpochMillis = System.currentTimeMillis() + lockDurationMillis;
                failures.set(0);
            }
        }
    }

    /**
     * Replays a buffered request body via {@link #getInputStream()}/{@link #getReader()} - lets
     * this filter read it once (for the email) without consuming it for whatever reads it next.
     */
    private static final class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBodyHttpServletRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return byteArrayInputStream.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                    // Not used - the body is fully buffered up front, no async body reading needed.
                }

                @Override
                public int read() {
                    return byteArrayInputStream.read();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
