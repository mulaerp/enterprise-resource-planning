package com.mulaerp.auth.security;

import com.mulaerp.shop.dto.ShopCustomerDto;
import com.mulaerp.shop.security.ShopJwtUtil;
import com.mulaerp.shop.service.ShopAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Second, separate authentication filter for the SHOP customer identity - runs alongside (NOT
 * instead of) {@link JwtAuthenticationFilter}, and is deliberately isolated from it in every
 * direction that matters for the security boundary:
 *
 * <ul>
 *   <li><b>Cookie name</b>: reads only {@value #SHOP_COOKIE_NAME}. Never reads the
 *       {@code Authorization} header or {@code MULAERP_AUTH} - a staff Bearer token or staff
 *       cookie is invisible to this filter, exactly as {@link JwtAuthenticationFilter} only ever
 *       reads {@code MULAERP_AUTH} and is blind to {@code MULAERP_SHOP} (different cookie name,
 *       no special-casing needed on that side either).</li>
 *   <li><b>Path scope</b> ({@link #shouldNotFilter}): only runs for requests under
 *       {@code /api/v1/shop/**}. This is the critical guard for the "shop cookie must not
 *       authenticate a staff endpoint" direction of the boundary - most staff GET endpoints have
 *       no method-level {@code @PreAuthorize} at all (see RoleRules javadoc: "No controller-
 *       level restriction... most GETs"), so they're only protected by
 *       {@code anyRequest().authenticated()} in SecurityConfig. If this filter populated
 *       {@code SecurityContextHolder} for a shop-cookie-bearing request against, say,
 *       {@code GET /api/v1/products}, that generic {@code authenticated()} check would pass and
 *       let a shop customer read staff data. Scoping the filter to shop paths means a shop
 *       cookie against a staff endpoint leaves {@code SecurityContextHolder} empty, and the
 *       staff endpoint correctly 401s.</li>
 *   <li><b>Authority</b>: populates exactly one authority, {@code ROLE_SHOP_CUSTOMER} - never
 *       any staff {@code ROLE_ADMIN}/{@code ROLE_MANAGER}/etc. SecurityConfig requires
 *       {@code hasRole('SHOP_CUSTOMER')} for {@code /api/v1/shop/**} (not just
 *       {@code authenticated()}), so even if a staff filter had already authenticated the same
 *       request (a staff cookie sent to a shop endpoint), that staff authority does not satisfy
 *       this role check - proven by the (ii) cross-boundary check in the task verification.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class ShopCustomerAuthenticationFilter extends OncePerRequestFilter {

    /** Name of the httpOnly cookie set by ShopAuthController on login/cleared on logout. */
    public static final String SHOP_COOKIE_NAME = "MULAERP_SHOP";

    private static final String SHOP_PATH_PREFIX = "/api/v1/shop/";

    private final ShopJwtUtil shopJwtUtil;
    private final ShopAuthService shopAuthService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(SHOP_PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractShopCookie(request);

        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            shopJwtUtil.validateShopToken(token)
                    .flatMap(shopAuthService::findActiveByEmail)
                    .ifPresent(customer -> authenticate(request, customer));
        }

        filterChain.doFilter(request, response);
    }

    private String extractShopCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (SHOP_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void authenticate(HttpServletRequest request, ShopCustomerDto customer) {
        UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                customer.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_SHOP_CUSTOMER")));
        authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authenticationToken);
    }
}
