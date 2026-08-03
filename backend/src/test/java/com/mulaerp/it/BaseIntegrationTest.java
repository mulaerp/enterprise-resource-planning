package com.mulaerp.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WP8+9: common base for the backend integration test suite.
 *
 * <p>Boots the full Spring context (webEnvironment=RANDOM_PORT) against a real Postgres +
 * Redis/Valkey - see scripts/run-backend-tests.sh for how those are provisioned as throwaway
 * Docker containers. Every subclass with identical {@code @SpringBootTest}/{@code @ActiveProfiles}
 * configuration shares Spring's context cache (one Spring Boot startup, not one per test class),
 * which is what keeps total suite runtime sane.
 *
 * <p>Uses {@link TestRestTemplate} against real HTTP + a real {@link JsonNode} response body
 * rather than typed DTOs, so these tests don't need to import every module's response DTO and
 * stay resilient to additive field changes - only the fields a given test actually asserts on
 * are read.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public abstract class BaseIntegrationTest {

    protected static final String ADMIN_EMAIL = "admin@mulaerp.com";
    protected static final String ADMIN_PASSWORD = "admin123";

    @LocalServerPort
    protected int port;

    @org.springframework.beans.factory.annotation.Autowired
    protected TestRestTemplate restTemplate;

    /** Cached per test-class-instance; JUnit5 default lifecycle is one instance per test method,
     *  so this is re-obtained per test - cheap (one HTTP round trip) and avoids any cross-test
     *  token-expiry edge cases. */
    private String adminToken;

    protected String baseUrl() {
        return "http://localhost:" + port + "/api/v1";
    }

    /** Root URL (no {@code /api/v1} prefix) - for actuator endpoints, which live outside it. */
    protected String rootUrl() {
        return "http://localhost:" + port;
    }

    protected String uniqueSuffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    // ---------------------------------------------------------------------------------------
    // Auth
    // ---------------------------------------------------------------------------------------

    /** Logs in as the seeded admin (admin@mulaerp.com/admin123 - see V14 migration) and returns
     *  the JWT. Asserts the login itself succeeded so a broken auth flow fails fast with a clear
     *  message rather than every downstream 401 being reported as the "real" failure. */
    protected synchronized String adminToken() {
        if (adminToken == null) {
            ResponseEntity<JsonNode> response = postNoAuth("/auth/login",
                    Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD));
            assertThat(response.getStatusCode())
                    .as("admin login must succeed - response body: %s", response.getBody())
                    .isEqualTo(HttpStatus.OK);
            adminToken = response.getBody().get("token").asText();
        }
        return adminToken;
    }

    protected HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    protected HttpHeaders authHeaders() {
        HttpHeaders headers = jsonHeaders();
        headers.setBearerAuth(adminToken());
        return headers;
    }

    // ---------------------------------------------------------------------------------------
    // Authenticated HTTP helpers
    // ---------------------------------------------------------------------------------------

    protected ResponseEntity<JsonNode> get(String path) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.GET, new HttpEntity<>(authHeaders()), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> post(String path, Object body) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.POST, new HttpEntity<>(body, authHeaders()), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> put(String path, Object body) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.PUT, new HttpEntity<>(body, authHeaders()), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> patch(String path) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.PATCH, new HttpEntity<>(authHeaders()), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> delete(String path) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.DELETE, new HttpEntity<>(authHeaders()), JsonNode.class);
    }

    // ---------------------------------------------------------------------------------------
    // Unauthenticated HTTP helpers (for testing the 401 path itself)
    // ---------------------------------------------------------------------------------------

    protected ResponseEntity<JsonNode> getNoAuth(String path) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.GET, new HttpEntity<>(jsonHeaders()), JsonNode.class);
    }

    protected ResponseEntity<JsonNode> postNoAuth(String path, Object body) {
        return restTemplate.exchange(baseUrl() + path, HttpMethod.POST, new HttpEntity<>(body, jsonHeaders()), JsonNode.class);
    }

    // ---------------------------------------------------------------------------------------
    // Stock adjustment numbers (InventoryService#generateAdjustmentNumber) now append a random
    // hex suffix to the second-granularity timestamp, making them unique by construction - no
    // throttling needed to keep concurrent/same-second POST /inventory/adjustments calls from
    // colliding on the DB's unique constraint (previously required a serializing helper here;
    // removed since it's no longer needed).
    // ---------------------------------------------------------------------------------------

    protected ResponseEntity<JsonNode> createStockAdjustment(Object requestBody) {
        return post("/inventory/adjustments", requestBody);
    }

    // ---------------------------------------------------------------------------------------
    // Small builder for request bodies, so tests read as a flat list of key/value pairs instead
    // of a wall of new HashMap<>()/put() calls.
    // ---------------------------------------------------------------------------------------

    protected static Map<String, Object> body(Object... kv) {
        if (kv.length % 2 != 0) {
            throw new IllegalArgumentException("body() requires an even number of key/value arguments");
        }
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            map.put((String) kv[i], kv[i + 1]);
        }
        return map;
    }
}
