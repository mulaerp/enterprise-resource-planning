package com.mulaerp.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WP8 (f): WP12's optimistic locking contract for Product - see
 * ProductService#updateProduct / BaseEntity's {@code @Version}. A client that edits a stale
 * copy (submits the version it last saw, not the current one) must be rejected with 409, not
 * silently overwrite a concurrent change - exactly the scenario a single-threaded unit test
 * against a mocked repository can't exercise, since the mock never carries real version state.
 */
class OptimisticLockIT extends BaseIntegrationTest {

    @Test
    void staleVersionOnUpdateIsRejectedWith409() {
        String suffix = uniqueSuffix();

        ResponseEntity<JsonNode> createResp = post("/products", body(
                "sku", "SKU-LOCK-" + suffix,
                "name", "Optimistic Lock Product " + suffix,
                "unitPrice", 15.00,
                "costPrice", 5.00,
                "stockQuantity", 10,
                "reorderLevel", 2,
                "status", "ACTIVE"
        ));
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = UUID.fromString(createResp.getBody().get("id").asText());

        JsonNode fetched = get("/products/" + productId).getBody();
        long originalVersion = fetched.get("version").asLong();

        // First update, submitting the version this client "last saw" - must succeed and bump
        // the version.
        ResponseEntity<JsonNode> firstUpdate = put("/products/" + productId, body(
                "name", "Optimistic Lock Product " + suffix + " v2",
                "unitPrice", 16.00,
                "costPrice", 5.00,
                "stockQuantity", 10,
                "reorderLevel", 2,
                "status", "ACTIVE",
                "version", originalVersion
        ));
        assertThat(firstUpdate.getStatusCode()).isEqualTo(HttpStatus.OK);
        long newVersion = firstUpdate.getBody().get("version").asLong();
        assertThat(newVersion).isGreaterThan(originalVersion);

        // Second update from a client that still has the *original* (now stale) version - must
        // be rejected with 409, never silently applied.
        ResponseEntity<JsonNode> staleUpdate = put("/products/" + productId, body(
                "name", "Optimistic Lock Product " + suffix + " v3-stale",
                "unitPrice", 99.00,
                "costPrice", 5.00,
                "stockQuantity", 10,
                "reorderLevel", 2,
                "status", "ACTIVE",
                "version", originalVersion
        ));
        assertThat(staleUpdate.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // The stale write must not have applied - unitPrice is still what the first update set.
        JsonNode afterStaleAttempt = get("/products/" + productId).getBody();
        assertThat(afterStaleAttempt.get("unitPrice").asDouble()).isEqualTo(16.00);
        assertThat(afterStaleAttempt.get("version").asLong()).isEqualTo(newVersion);
    }
}
