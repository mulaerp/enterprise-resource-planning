package com.mulaerp.shop.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * JWT issuance/validation for the {@code MULAERP_SHOP} cookie - completely separate from
 * {@code com.mulaerp.auth.security.JwtUtil} (staff), even though it reuses the same
 * {@code jwt.secret}/{@code jwt.expiration} configuration (no new externalised property needed
 * for this).
 *
 * <p>Two independent layers keep a staff token from ever being usable as a shop token even
 * though they share a signing key:
 * <ol>
 *   <li><b>Transport</b>: the staff cookie is named {@code MULAERP_AUTH}, the shop cookie
 *       {@code MULAERP_SHOP} - {@code ShopCustomerAuthenticationFilter} only ever reads the
 *       latter, {@code JwtAuthenticationFilter} only the former.</li>
 *   <li><b>Claim shape</b> (defense in depth, in case a raw token value is ever copied between
 *       cookies): every shop token carries a {@code "typ": "SHOP_CUSTOMER"} claim that
 *       {@link #validateShopToken(String)} requires - a validly-signed staff token has no such
 *       claim and is rejected here even though the signature checks out.</li>
 * </ol>
 */
@Component
public class ShopJwtUtil {

    private static final String TYPE_CLAIM = "typ";
    private static final String TYPE_VALUE = "SHOP_CUSTOMER";

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String email, UUID customerId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("customerId", customerId.toString());
        claims.put(TYPE_CLAIM, TYPE_VALUE);
        return Jwts.builder()
                .claims(claims)
                .subject(email)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public long expirationSeconds() {
        return expiration / 1000;
    }

    /**
     * Returns the customer's email if {@code token} is a validly-signed, unexpired, correctly-
     * typed shop token - otherwise empty. Never throws; every failure mode (bad signature,
     * expired, wrong/missing {@code typ} claim - including a perfectly valid staff-issued token)
     * collapses to "not authenticated" for the caller.
     */
    public java.util.Optional<String> validateShopToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            if (!TYPE_VALUE.equals(claims.get(TYPE_CLAIM, String.class))) {
                return java.util.Optional.empty();
            }
            if (claims.getExpiration().before(new Date())) {
                return java.util.Optional.empty();
            }
            return java.util.Optional.ofNullable(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return java.util.Optional.empty();
        }
    }
}
