package com.mulaerp.audit.service;

import com.mulaerp.audit.entity.AuditLog;
import com.mulaerp.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Persists the automatic, site-wide audit trail rows queued by {@link
 * com.mulaerp.audit.listener.AuditPersistenceEventListener}.
 *
 * <p>Deliberately NOT {@code @Async} (unlike the existing {@link AuditService} manual-call
 * path): the caller invokes this from a transaction-synchronization {@code afterCompletion}
 * callback that only fires once the owning business transaction has committed, so writing
 * synchronously (rather than handing off to another thread) keeps the observable guarantee -
 * "rollback of the business op = no audit row" - intact: a rolled-back transaction never reaches
 * that callback at all. {@code REQUIRES_NEW} because by the time this runs, the original
 * transaction/session is already closed - there is nothing to join.
 *
 * <p>Every public method still guards its own body with try/catch so a failure writing the
 * audit row (e.g. a transient DB hiccup) never fails, or gets blamed on, the business operation
 * that already succeeded.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogWriter {

    private static final int MAX_SUMMARY_LENGTH = 4000;

    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String entityType, UUID entityId, String action, String changeSummary) {
        try {
            AuditLog entry = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .username(resolveUsername())
                    .changeSummary(truncate(changeSummary))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Automatic audit logging failed for {} {} ({}): {}", action, entityType, entityId, e.getMessage());
        }
    }

    private String resolveUsername() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
                return "system";
            }
            String name = auth.getName();
            return (name == null || name.isBlank()) ? "system" : name;
        } catch (Exception e) {
            return "system";
        }
    }

    private String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > MAX_SUMMARY_LENGTH
                ? value.substring(0, MAX_SUMMARY_LENGTH) + "...(truncated)"
                : value;
    }
}
