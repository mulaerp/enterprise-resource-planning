package com.mulaerp.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WP8 (b): the core auth contract - login issues a usable JWT, that JWT is required (and
 * sufficient) for a protected endpoint, and the 401 paths (no token / wrong password) return the
 * standard API error JSON shape (see GlobalExceptionHandler / SecurityConfig's
 * authenticationEntryPoint) rather than an empty body or a stack trace.
 */
class AuthFlowIT extends BaseIntegrationTest {

    @Test
    void loginWithSeededAdminReturnsUsableToken() {
        ResponseEntity<JsonNode> response = postNoAuth("/auth/login",
                Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = response.getBody();
        assertThat(body.get("token").asText()).isNotBlank();
        assertThat(body.get("user").get("email").asText()).isEqualTo(ADMIN_EMAIL);
        assertThat(body.get("user").get("role").asText()).isEqualTo("ADMIN");
    }

    @Test
    void productsEndpointRequiresToken() {
        ResponseEntity<JsonNode> withToken = get("/products");
        assertThat(withToken.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(withToken.getBody().has("content")).isTrue();
    }

    @Test
    void productsEndpointWithoutTokenReturns401Json() {
        ResponseEntity<JsonNode> response = getNoAuth("/products");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        JsonNode body = response.getBody();
        assertThat(body.get("status").asInt()).isEqualTo(401);
        assertThat(body.get("path").asText()).isEqualTo("/api/v1/products");
        assertThat(body.get("message").asText()).isNotBlank();
    }

    @Test
    void loginWithWrongPasswordReturns401() {
        ResponseEntity<JsonNode> response = postNoAuth("/auth/login",
                Map.of("email", ADMIN_EMAIL, "password", "definitely-not-the-password"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("message").asText()).isEqualTo("Invalid email or password");
    }
}
