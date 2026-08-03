package com.mulaerp.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mulaerp.common.exception.GlobalExceptionHandler.ErrorResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ShopCustomerAuthenticationFilter shopCustomerAuthenticationFilter;
    private final UserDetailsService userDetailsService;
    private final ObjectMapper objectMapper;

    // Explicit constructor (not @RequiredArgsConstructor) so @Lazy can be placed on the
    // shopCustomerAuthenticationFilter PARAMETER - Lombok's generated constructor does not copy
    // @Lazy from a field onto the parameter, so that annotation is a no-op there. @Lazy breaks a
    // real bean-creation cycle: ShopCustomerAuthenticationFilter depends on ShopAuthService,
    // which depends on the PasswordEncoder @Bean defined further down in THIS class, which
    // Spring can't construct until this class's own constructor (needing the filter) has
    // already run. Deferring resolution to first actual use (a real request reaching the filter
    // chain, by which time the whole context is up) breaks the cycle without moving the
    // PasswordEncoder bean out of this file.
    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            @Lazy ShopCustomerAuthenticationFilter shopCustomerAuthenticationFilter,
            UserDetailsService userDetailsService,
            ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.shopCustomerAuthenticationFilter = shopCustomerAuthenticationFilter;
        this.userDetailsService = userDetailsService;
        this.objectMapper = objectMapper;
    }

    // Externalised (deployment hardening) so a deployment sets its own domain(s) without a code
    // change. Default is unchanged from before: the local dev origins plus "frontend" - the
    // compose service name that's the origin the browser uses when the e2e suite runs the
    // frontend inside the Docker network.
    @Value("${mulaerp.cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://localhost,http://frontend:5173}")
    private List<String> corsAllowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
                        .frameOptions(frame -> frame.deny())
                        .xssProtection(xss -> xss.headerValue(org.springframework.security.web.header.writers.XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                        .contentTypeOptions(contentType -> {})
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // OWNER DECISION (2026-08): online postal/drop-off trade-in quotes are
                        // MEMBERS-ONLY - a guest may browse and buy freely but may NOT request or
                        // look up a trade-in quote without a shop account (staff need to contact
                        // the seller and pay them; a guest quote also had no way to ever accept/
                        // decline a staff final offer once inspected - a permanent dead end, see
                        // ShopTradeInQuoteService's class javadoc). The old guest endpoints
                        // (PublicShopQuoteController) have been deleted outright, but this matcher
                        // is declared BEFORE the general "/api/v1/public/**" permitAll rule below
                        // (registration order decides precedence) so this whole sub-path can never
                        // again be accidentally exposed as permitAll by a future change to that
                        // general rule - denyAll() here means even a re-added controller under
                        // this path stays blocked at the filter-chain layer regardless of its own
                        // annotations. An anonymous request here gets a 401 (not 403) via
                        // authenticationEntryPoint() below, since ExceptionTranslationFilter
                        // routes a denied ANONYMOUS principal to the entry point rather than the
                        // access-denied handler - verified live as part of this task's own
                        // verification gate.
                        .requestMatchers("/api/v1/public/shop/quotes/**").denyAll()
                        .requestMatchers(
                                // Only login/logout are unauthenticated. GET /auth/me deliberately is
                                // NOT in this list (previously "/api/v1/auth/**" covered it too) so it
                                // falls through to anyRequest().authenticated() below: with no valid
                                // Bearer header or MULAERP_AUTH cookie, the filter chain never populates
                                // SecurityContextHolder, and this now gets the standard 401 JSON via
                                // authenticationEntryPoint() below instead of a NullPointerException
                                // (AuthService#getCurrentUser calling .getName() on a null Authentication).
                                "/api/v1/auth/login",
                                "/api/v1/auth/logout",
                                "/api/v1/health",
                                "/api/v1/public/**",
                                "/actuator/health/**",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/ws/**",
                                // SHOP customer identity (WEBSHOP task) - separate identity from
                                // staff, see ShopCustomerAuthenticationFilter's javadoc for the
                                // full boundary rationale. Only register/login/logout are
                                // unauthenticated; GET /shop/auth/me is deliberately excluded
                                // (same reasoning as staff /auth/me above) so it falls through to
                                // the hasRole('SHOP_CUSTOMER') matcher below.
                                "/api/v1/shop/auth/register",
                                "/api/v1/shop/auth/login",
                                "/api/v1/shop/auth/logout"
                        ).permitAll()
                        // Staff side of the SHOP module lives under /api/v1/shop/admin/** - shared
                        // by postal/drop-off trade-in quotes (WEBSHOP owner decision 3,
                        // ShopAdminQuoteController) AND online order management (WEBSHOP owner
                        // decisions 1/2, ShopOrderAdminController) - carved out of the blanket
                        // shop-customer rule below, since both must be usable by a
                        // STAFF-authenticated request (ROLE_ADMIN/MANAGER/ACCOUNTANT/INVENTORY/
                        // CASHIER via JwtAuthenticationFilter), which never carries
                        // ROLE_SHOP_CUSTOMER. Ordering matters here: Spring Security's
                        // authorizeHttpRequests matches in registration order, so this more
                        // specific matcher must be declared BEFORE the general "/api/v1/shop/**"
                        // rule to win for this sub-path - authenticated() only at this layer; each
                        // controller's own method-level @PreAuthorize (RoleRules constants) does
                        // the actual per-action role narrowing (mirrors the existing
                        // PosTradeInController precedent of no controller-level restriction).
                        .requestMatchers("/api/v1/shop/admin/**").authenticated()
                        // Everything else under /api/v1/shop/** requires the ROLE_SHOP_CUSTOMER
                        // authority populated only by ShopCustomerAuthenticationFilter from the
                        // MULAERP_SHOP cookie - deliberately a specific role check, not just
                        // authenticated(), so a staff-authenticated request (ROLE_ADMIN etc.,
                        // however it got authenticated) is rejected here too - see the (ii)
                        // cross-boundary check in the WEBSHOP task verification.
                        .requestMatchers("/api/v1/shop/**").hasRole("SHOP_CUSTOMER")
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                // WP11: previously unset, so Spring Security's own default entry point/handler
                // took over for filter-chain-level 401s (no/bad token) and 403s (authorizeHttpRequests
                // denials) - which return an empty body / plain text, not the standard API error
                // shape. These write the same {timestamp, status, error, message, path} JSON as
                // GlobalExceptionHandler (which only sees exceptions raised inside the
                // DispatcherServlet, e.g. @PreAuthorize denials - not these filter-chain ones).
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler())
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // Second, separate filter for the SHOP customer identity - path-scoped to
                // /api/v1/shop/** internally (see its shouldNotFilter), so it never runs
                // against staff endpoints regardless of chain order relative to
                // jwtAuthenticationFilter above.
                .addFilterBefore(shopCustomerAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> writeJsonError(
                response, HttpStatus.UNAUTHORIZED, "Authentication is required to access this resource", request.getRequestURI());
    }

    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> writeJsonError(
                response, HttpStatus.FORBIDDEN, "You do not have permission to access this resource", request.getRequestURI());
    }

    private void writeJsonError(jakarta.servlet.http.HttpServletResponse response, HttpStatus status, String message, String path)
            throws java.io.IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ErrorResponse error = new ErrorResponse(status.value(), status.getReasonPhrase(), message, path);
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }
    
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // mulaerp.cors.allowed-origins (see field javadoc above) — externalised so a deployment
        // sets its own domain(s) via env/.env instead of editing this file.
        configuration.setAllowedOrigins(corsAllowedOrigins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
    
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }
    
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
