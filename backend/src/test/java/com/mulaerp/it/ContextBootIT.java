package com.mulaerp.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WP8 (a): the highest-value integration test in this suite. {@code @SpringBootTest} boots the
 * full application context against a real, from-scratch Postgres database, which means:
 *   - Flyway applies V1 through the current highest migration in order, from an empty schema;
 *   - Hibernate's {@code ddl-auto: validate} then checks every JPA entity mapping against the
 *     schema those migrations produced.
 * A mismatch between an entity and its migrations (missing column, wrong type, wrong
 * nullability, a migration that doesn't apply cleanly from zero) fails right here, at context
 * refresh, before any other test in the suite gets a chance to run - exactly the class of bug
 * that unit tests (which mock the repository layer entirely) cannot see.
 */
class ContextBootIT extends BaseIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoadsAndFlywayMigrationsApplyCleanly() {
        // Reaching this point already proved Flyway + Hibernate validate succeeded (see class
        // Javadoc) - this assertion just gives a concrete, human-readable signal of *how far*
        // Flyway got, by checking the last migration this suite was written against.
        Integer appliedCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success = true AND version = '23'",
                Integer.class);
        assertThat(appliedCount).as("V23 (latest migration at time of writing) must be applied").isEqualTo(1);

        Integer failedCount = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success = false",
                Integer.class);
        assertThat(failedCount).as("no failed Flyway migration rows").isEqualTo(0);
    }

    @Test
    void healthEndpointIsUpWithRealDbAndRedis() {
        // /actuator/health is permitAll (see SecurityConfig) - no token needed. Spring Boot's
        // auto-configured db + redis health indicators mean this transitively proves both real
        // dependencies (not mocks) are reachable from the application.
        ResponseEntity<JsonNode> response = restTemplate.exchange(
                rootUrl() + "/actuator/health", HttpMethod.GET, new HttpEntity<>(jsonHeaders()), JsonNode.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status").asText()).isEqualTo("UP");
    }
}
