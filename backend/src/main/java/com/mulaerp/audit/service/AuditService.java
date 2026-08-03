package com.mulaerp.audit.service;

import com.mulaerp.audit.dto.AuditLogDTO;
import com.mulaerp.audit.entity.AuditLog;
import com.mulaerp.audit.repository.AuditLogRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Audit Service
 * Phase 5.2: Security Hardening
 * WP5: added the read-side query backing GET /api/v1/audit-logs (the write side for the
 * automatic, site-wide trail lives in AuditLogWriter - this service keeps serving the existing
 * manual logCreate/logUpdate/logDelete calls unchanged).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public Page<AuditLogDTO> getAuditLogs(String entityType, UUID entityId, String username, String action,
                                           LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        Specification<AuditLog> spec = buildSpecification(entityType, entityId, username, action, startDate, endDate);
        return auditLogRepository.findAll(spec, pageable).map(this::toDto);
    }

    private Specification<AuditLog> buildSpecification(String entityType, UUID entityId, String username, String action,
                                                         LocalDateTime startDate, LocalDateTime endDate) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (entityType != null && !entityType.isBlank()) {
                predicates.add(cb.equal(root.get("entityType"), entityType));
            }
            // PROBLEM 2 fix: entityId filter so a single entity's full history is queryable
            // (previously only entityType was exposed, even though
            // AuditLogRepository#findByEntityTypeAndEntityId already existed unused).
            if (entityId != null) {
                predicates.add(cb.equal(root.get("entityId"), entityId));
            }
            if (username != null && !username.isBlank()) {
                predicates.add(cb.equal(root.get("username"), username));
            }
            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private AuditLogDTO toDto(AuditLog log) {
        return AuditLogDTO.builder()
                .id(log.getId())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .action(log.getAction())
                .username(log.getUsername())
                .changeSummary(log.getChangeSummary())
                .createdAt(log.getCreatedAt())
                .build();
    }

    @Async
    @Transactional
    public void logAction(UUID userId, String action, String entityType, UUID entityId, 
                         String oldValue, String newValue, String ipAddress, String userAgent) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .oldValue(oldValue)
                    .newValue(newValue)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .build();
            
            auditLogRepository.save(auditLog);
            log.info("Audit log created: {} {} by user {}", action, entityType, userId);
        } catch (Exception e) {
            log.error("Failed to create audit log", e);
        }
    }
    
    @Async
    @Transactional
    public void logCreate(UUID userId, String entityType, UUID entityId, String value, 
                         String ipAddress, String userAgent) {
        logAction(userId, "CREATE", entityType, entityId, null, value, ipAddress, userAgent);
    }
    
    @Async
    @Transactional
    public void logUpdate(UUID userId, String entityType, UUID entityId, String oldValue, 
                         String newValue, String ipAddress, String userAgent) {
        logAction(userId, "UPDATE", entityType, entityId, oldValue, newValue, ipAddress, userAgent);
    }
    
    @Async
    @Transactional
    public void logDelete(UUID userId, String entityType, UUID entityId, String value, 
                         String ipAddress, String userAgent) {
        logAction(userId, "DELETE", entityType, entityId, value, null, ipAddress, userAgent);
    }
}
