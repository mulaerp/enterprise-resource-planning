package com.mulaerp.shop.controller;

import com.mulaerp.auth.security.ShopCustomerAuthenticationFilter;
import com.mulaerp.shop.dto.ShopCustomerDto;
import com.mulaerp.shop.dto.ShopLoginRequest;
import com.mulaerp.shop.dto.ShopRegisterRequest;
import com.mulaerp.shop.security.ShopJwtUtil;
import com.mulaerp.shop.service.ShopAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Customer-facing auth for the B2C storefront ({@code /api/v1/shop/auth/**}) - register/login/
 * logout are permitAll (see SecurityConfig), {@code GET me} requires the
 * {@code ROLE_SHOP_CUSTOMER} authority populated by {@code ShopCustomerAuthenticationFilter}.
 *
 * <p>Cookie-only session, no token in the response body (unlike the staff
 * {@code AuthController}, which keeps a body token for API/curl clients) - the storefront
 * frontend never needs to hold a token in JS (see {@code ShopAuthContext.tsx}), and there is no
 * equivalent "Bearer header" API client use case in scope for the shop identity yet.
 */
@RestController
@RequestMapping("/api/v1/shop/auth")
@RequiredArgsConstructor
public class ShopAuthController {

    private final ShopAuthService shopAuthService;
    private final ShopJwtUtil shopJwtUtil;

    // Reuses the SAME externalised property as the staff MULAERP_AUTH cookie
    // (mulaerp.auth.cookie-secure) - one Secure-flag switch for a deployment, not two.
    @Value("${mulaerp.auth.cookie-secure:false}")
    private boolean cookieSecure;

    @PostMapping("/register")
    public ResponseEntity<ShopCustomerDto> register(@Valid @RequestBody ShopRegisterRequest request) {
        ShopCustomerDto customer = shopAuthService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(customer);
    }

    @PostMapping("/login")
    public ResponseEntity<ShopCustomerDto> login(@Valid @RequestBody ShopLoginRequest request) {
        ShopCustomerDto customer = shopAuthService.login(request);
        String token = shopJwtUtil.generateToken(customer.getEmail(), customer.getId());
        ResponseCookie cookie = shopCookie(token, shopJwtUtil.expirationSeconds());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(customer);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        ResponseCookie cookie = shopCookie("", 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<ShopCustomerDto> me() {
        // ShopCustomerAuthenticationFilter has already validated the MULAERP_SHOP cookie and
        // populated the authentication's name with the customer's email by this point - falling
        // through here without a valid one means SecurityConfig's "hasRole('SHOP_CUSTOMER')"
        // matcher already rejected the request with a 401 before this method body ever runs.
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        ShopCustomerDto customer = shopAuthService.findActiveByEmail(email)
                .orElseThrow(() -> new com.mulaerp.common.exception.ResourceNotFoundException("Customer not found"));
        return ResponseEntity.ok(customer);
    }

    private ResponseCookie shopCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(ShopCustomerAuthenticationFilter.SHOP_COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAgeSeconds)
                .build();
    }
}
