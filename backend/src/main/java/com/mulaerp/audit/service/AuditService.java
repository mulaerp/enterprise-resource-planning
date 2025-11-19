package com.mulaerp.audit.service;

import com.mulaerp.audit.entity.AuditLog;
import com.mulaerp.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Audit Service
 * Phase 5.2: Security Hardening
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {
    
    private final AuditLogRepository auditLogRepository;
    
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
