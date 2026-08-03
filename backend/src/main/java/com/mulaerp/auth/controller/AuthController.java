package com.mulaerp.auth.controller;

import com.mulaerp.auth.dto.LoginRequest;
import com.mulaerp.auth.dto.LoginResponse;
import com.mulaerp.auth.dto.UserDTO;
import com.mulaerp.auth.security.JwtAuthenticationFilter;
import com.mulaerp.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${jwt.expiration}")
    private long jwtExpirationMs;

    @Value("${mulaerp.auth.cookie-secure:false}")
    private boolean cookieSecure;

    /**
     * Dual-mode login: sets an httpOnly MULAERP_AUTH cookie (what the frontend now relies on -
     * see AuthContext/api.ts, which no longer touch localStorage) AND keeps returning the token
     * in the response body. The body token is kept intentionally for API clients, curl-based
     * workflows, and the backend integration suite (BaseIntegrationTest), which all authenticate
     * with a Bearer header - see README "Deploying beyond localhost" for the rationale.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        ResponseCookie cookie = authCookie(response.getToken(), jwtExpirationMs / 1000);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser() {
        UserDTO user = authService.getCurrentUser();
        return ResponseEntity.ok(user);
    }

    /**
     * Clears the httpOnly auth cookie by re-setting it with Max-Age=0.
     *
     * <p>permitAll (unchanged from the existing "/api/v1/auth/**" rule in SecurityConfig -
     * no filter-chain change needed): logout has to reliably clear a stale or already-expired
     * cookie even when the JWT it carries no longer validates, and it performs no per-user
     * action that needs authorization - it never reads the caller's identity, it just tells the
     * browser to drop the cookie.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        ResponseCookie cookie = authCookie("", 0);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    private ResponseCookie authCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(JwtAuthenticationFilter.AUTH_COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAgeSeconds)
                .build();
    }
}
