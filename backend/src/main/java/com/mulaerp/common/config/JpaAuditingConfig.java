package com.mulaerp.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * WP11: {@code @EnableJpaAuditing} is already declared on {@link com.mulaerp.MulaErpApplication},
 * which is why {@code @CreatedDate}/{@code @LastModifiedDate} on {@link com.mulaerp.common.entity.BaseEntity}
 * have always worked - but there was no {@link AuditorAware} bean, so {@code @CreatedBy}/
 * {@code @LastModifiedBy} (the {@code created_by}/{@code updated_by} columns) resolved to null on
 * every row, app-wide. This supplies the missing piece: the authenticated username from the
 * {@link SecurityContextHolder} (set by {@code JwtAuthenticationFilter}), falling back to
 * {@code "system"} for unauthenticated writes (scheduled jobs, startup data, anonymous requests).
 *
 * <p>This only feeds Spring Data JPA's auditing (createdBy/updatedBy columns on the entity
 * itself, populated by {@code AuditingEntityListener} at {@code @PrePersist}/{@code @PreUpdate}).
 * It is independent of the WP5 site-wide audit trail ({@code audit_logs} table, written by
 * {@link com.mulaerp.audit.listener.AuditPersistenceEventListener} off Hibernate's native
 * {@code POST_INSERT}/{@code POST_UPDATE}/{@code POST_DELETE} events) - that listener already
 * ignores the {@code createdBy}/{@code updatedBy} properties when building its changed-field
 * diff (see {@code AuditPersistenceEventListener.IGNORED_PROPERTIES}), so populating them here
 * does not add noise to the audit trail's change summaries.
 */
@Configuration
public class JpaAuditingConfig {

    private static final String SYSTEM_AUDITOR = "system";

    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null
                    || !authentication.isAuthenticated()
                    || authentication instanceof AnonymousAuthenticationToken) {
                return Optional.of(SYSTEM_AUDITOR);
            }
            return Optional.ofNullable(authentication.getName()).or(() -> Optional.of(SYSTEM_AUDITOR));
        };
    }
}
