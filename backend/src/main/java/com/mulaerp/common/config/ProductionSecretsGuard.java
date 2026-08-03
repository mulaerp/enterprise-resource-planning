package com.mulaerp.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Deployment-hardening startup guard: refuses to boot with {@code SPRING_PROFILES_ACTIVE=production}
 * if {@code jwt.secret} is missing, shorter than 32 characters, or still equal to one of the
 * example values ever shipped in this repo (application.yml's own default, or the compose.yaml /
 * .env.example placeholder) - i.e. a deploy that pasted the example straight into its real .env
 * instead of generating a unique secret.
 *
 * <p>Deliberately narrow in scope (jwt.secret only, not DATABASE_PASSWORD/REDIS_PASSWORD): those
 * two now have no fallback at all in compose.yaml ({@code ${VAR:?...}}), so `docker compose up`
 * already fails before the JVM even starts if they're unset - there's no equivalent "empty
 * Spring default" footgun for them the way there is for jwt.secret (application.yml's
 * {@code ${JWT_SECRET:your-secret-key-...}} placeholder is still reachable if JWT_SECRET is unset
 * but every other required var happens to be set, e.g. running the jar directly outside compose).
 *
 * <p>Runs as an {@link ApplicationRunner}, i.e. after the context has fully started - throwing
 * here still fails {@code SpringApplication.run()} and exits the process non-zero, which is what
 * "fail startup" means in practice for a Spring Boot app (there is no earlier hook that already
 * has the fully-resolved {@code jwt.secret} property available).
 */
@Component
@Slf4j
public class ProductionSecretsGuard implements ApplicationRunner {

    // Every example/placeholder value this exact secret has ever appeared as in this repo
    // (application.yml's own default, and the compose.yaml / .env.example placeholder that
    // preceded the required-env-var hardening) - a production deploy that copy-pasted one of
    // these in instead of generating a real secret is exactly the mistake this guard catches.
    private static final Set<String> KNOWN_EXAMPLE_SECRETS = Set.of(
            "your-secret-key-min-32-characters-long-please-change-in-production",
            "your-super-secret-jwt-key-change-in-production-min-32-chars"
    );

    private static final int MIN_SECRET_LENGTH = 32;
    private static final String PRODUCTION_PROFILE = "production";

    private final Environment environment;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    public ProductionSecretsGuard(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!isProductionProfile()) {
            return;
        }

        boolean isKnownExample = KNOWN_EXAMPLE_SECRETS.contains(jwtSecret);
        boolean isTooShort = jwtSecret == null || jwtSecret.length() < MIN_SECRET_LENGTH;

        if (isKnownExample || isTooShort) {
            String reason = isKnownExample
                    ? "it matches a known example/placeholder value"
                    : "it is missing or shorter than " + MIN_SECRET_LENGTH + " characters";
            String message = "Refusing to start with SPRING_PROFILES_ACTIVE=" + PRODUCTION_PROFILE
                    + ": jwt.secret is unsafe (" + reason + "). Set a unique, randomly generated "
                    + "JWT_SECRET (>= " + MIN_SECRET_LENGTH + " chars, e.g. `openssl rand -base64 48`) "
                    + "via environment/.env before deploying - see README \"Deploying beyond localhost\".";
            log.error(message);
            throw new IllegalStateException(message);
        }
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if (PRODUCTION_PROFILE.equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }
}
