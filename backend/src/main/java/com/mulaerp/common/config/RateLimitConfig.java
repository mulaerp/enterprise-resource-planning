package com.mulaerp.common.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate Limiting Configuration
 * Phase 5.2: Security Hardening
 *
 * <p>WP11: scope and policy tightened for local/e2e reality (no reverse proxy in front of this
 * deployment):
 * <ul>
 *   <li>{@link com.mulaerp.common.filter.RateLimitFilter} now only runs this bucket against
 *       {@code /api/v1/auth/**} (login brute-force is the actual local threat; throttling every
 *       API call was incidental over-reach from the original Phase 5.2 filter, which had no path
 *       scoping at all).</li>
 *   <li>Keyed on the direct socket remote address ({@code HttpServletRequest.getRemoteAddr()}) by
 *       default - see {@link #isTrustedProxy} below for when (and only when) that changes.</li>
 *   <li>Limit: 300 requests per 15 minutes per IP. This is deliberately generous for a
 *       login-only bucket: the Playwright e2e suite logs in once per test across ~160 Chromium
 *       tests in a single run, sharing one source IP (the compose network address the test
 *       runner is seen as) - 300/15min gives roughly 2x headroom over that so the suite never
 *       trips it, while still bounding a wrong-password loop to a couple of requests per second
 *       sustained, which is enough to blunt a brute-force attempt against bcrypt-hashed
 *       passwords.</li>
 * </ul>
 *
 * <p>WP-deploy-hardening additions:
 * <ul>
 *   <li><b>Public catalogue/warranty-lookup bucket</b> - before this, everything outside
 *       {@code /api/v1/auth/**} was completely unthrottled, so a scripted client could enumerate
 *       warranty codes ({@code GET /api/v1/public/warranty/{code}}) or scrape the storefront
 *       catalogue without limit (verified live by the deployment audit). 600 requests / 5 minutes
 *       per IP (~2 req/s sustained, 120 req/min average) is sized against the two real traffic
 *       patterns that must NOT trip it:
 *       <ul>
 *         <li>{@code StorefrontPage}'s own 30s auto-refresh
 *             ({@code REFRESH_INTERVAL_MS}): ~10 requests / 5min per open browsing tab -
 *             negligible against the 600 budget.</li>
 *         <li>The Playwright e2e suite (single container IP, one worker, ~5 min total run):
 *             {@code storefront.spec.ts} (8 tests, each {@code goto('/')} triggering
 *             catalog+categories+currencies, ~3-4 calls) and {@code warranties.spec.ts} (6 tests
 *             touching {@code /shop/warranty} plus a lookup call), plus incidental public hits
 *             elsewhere in the ~212-test suite - well under 100 requests total across the whole
 *             run, leaving 6x+ headroom under the 600 budget. A synthetic burst of 700 requests
 *             in 5 minutes (comfortably beyond anything the suite generates) is expected to trip
 *             this bucket and return 429, which is the point.</li>
 *       </ul>
 *       See {@link com.mulaerp.common.filter.RateLimitFilter} for how the bucket is selected per
 *       path.</li>
 *   <li><b>Trusted-proxy X-Forwarded-For support</b> ({@link #isTrustedProxy}) - only trusted when
 *       the direct socket address is inside a CIDR listed in
 *       {@code mulaerp.rate-limit.trusted-proxies} (empty by default, e.g. locally/no-proxy,
 *       preserving today's safe behaviour of always keying on the direct socket address). Set
 *       this to the actual reverse proxy's container/subnet CIDR - e.g. the nginx service in
 *       compose.yaml - in a deployment that puts one in front of the backend, otherwise every
 *       request appears to come from the proxy's single IP and collapses into one shared bucket.
 *       Never set this to a wildcard/public range: X-Forwarded-For is attacker-controlled unless
 *       the immediate peer is a proxy you trust to have overwritten it correctly.</li>
 * </ul>
 */
@Configuration
public class RateLimitConfig {

    private static final int LOGIN_LIMIT = 300;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);

    private static final int PUBLIC_LIMIT = 600;
    private static final Duration PUBLIC_WINDOW = Duration.ofMinutes(5);

    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> publicBuckets = new ConcurrentHashMap<>();

    @Value("#{'${mulaerp.rate-limit.trusted-proxies:}'.split(',')}")
    private List<String> trustedProxyCidrs;

    private List<CidrRange> parsedTrustedProxies = List.of();

    @PostConstruct
    void init() {
        List<CidrRange> parsed = new ArrayList<>();
        for (String raw : trustedProxyCidrs) {
            String cidr = raw.trim();
            if (cidr.isEmpty()) {
                continue;
            }
            try {
                parsed.add(CidrRange.parse(cidr));
            } catch (Exception e) {
                throw new IllegalStateException(
                        "Invalid mulaerp.rate-limit.trusted-proxies entry: '" + cidr + "'", e);
            }
        }
        this.parsedTrustedProxies = parsed;
    }

    /**
     * Get or create the login rate-limit bucket for a key (normally the client IP).
     * Limit: 300 requests per 15 minutes (see class javadoc for rationale).
     */
    public Bucket resolveLoginBucket(String key) {
        return loginBuckets.computeIfAbsent(key, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(LOGIN_LIMIT, Refill.intervally(LOGIN_LIMIT, LOGIN_WINDOW)))
                .build());
    }

    /**
     * Get or create the public-catalogue/warranty-lookup rate-limit bucket for a key (normally
     * the client IP). Limit: 600 requests per 5 minutes (see class javadoc for headroom math).
     */
    public Bucket resolvePublicBucket(String key) {
        return publicBuckets.computeIfAbsent(key, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(PUBLIC_LIMIT, Refill.intervally(PUBLIC_LIMIT, PUBLIC_WINDOW)))
                .build());
    }

    /**
     * True only when {@code remoteAddr} (the direct socket peer) is inside one of the configured
     * trusted-proxy CIDRs - i.e. it is safe to trust an X-Forwarded-For header it supplies.
     * Always false when {@code mulaerp.rate-limit.trusted-proxies} is unset/empty.
     */
    public boolean isTrustedProxy(String remoteAddr) {
        if (parsedTrustedProxies.isEmpty() || remoteAddr == null) {
            return false;
        }
        try {
            InetAddress addr = InetAddress.getByName(remoteAddr);
            for (CidrRange range : parsedTrustedProxies) {
                if (range.contains(addr)) {
                    return true;
                }
            }
        } catch (UnknownHostException e) {
            return false;
        }
        return false;
    }

    /**
     * Minimal IPv4/IPv6 CIDR matcher. No extra dependency pulled in for this narrow use (compare
     * the address's first {@code prefixLength} bits against the network's).
     */
    private static final class CidrRange {
        private final byte[] network;
        private final int prefixLength;

        private CidrRange(byte[] network, int prefixLength) {
            this.network = network;
            this.prefixLength = prefixLength;
        }

        static CidrRange parse(String cidr) throws UnknownHostException {
            String[] parts = cidr.split("/", 2);
            InetAddress addr = InetAddress.getByName(parts[0].trim());
            byte[] bytes = addr.getAddress();
            int maxPrefix = bytes.length * 8;
            int prefix = parts.length == 2 ? Integer.parseInt(parts[1].trim()) : maxPrefix;
            if (prefix < 0 || prefix > maxPrefix) {
                throw new IllegalArgumentException("Prefix length out of range for " + cidr);
            }
            return new CidrRange(bytes, prefix);
        }

        boolean contains(InetAddress candidate) {
            byte[] candidateBytes = candidate.getAddress();
            if (candidateBytes.length != network.length) {
                return false; // address family mismatch (IPv4 vs IPv6)
            }
            int fullBytes = prefixLength / 8;
            int remainingBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (candidateBytes[i] != network[i]) {
                    return false;
                }
            }
            if (remainingBits == 0) {
                return true;
            }
            int mask = (0xFF << (8 - remainingBits)) & 0xFF;
            return (candidateBytes[fullBytes] & mask) == (network[fullBytes] & mask);
        }
    }
}
