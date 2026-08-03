package com.mulaerp.audit.repository;

import com.mulaerp.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Audit Log Repository
 * Phase 5.2: Security Hardening
 * WP5: extended with JpaSpecificationExecutor to back the multi-filter search behind
 * GET /api/v1/audit-logs (see AuditService#getAuditLogs). A hand-written JPQL query with
 * "(:param IS NULL OR field = :param)" placeholders for every optional filter was tried first,
 * but Postgres' JDBC driver can't infer the parameter type for an untyped NULL bound against a
 * timestamp column ("could not determine data type of parameter") - Specifications only add a
 * predicate (and bind parameter) for filters that are actually present, sidestepping the problem.
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {

    Page<AuditLog> findByUserId(UUID userId, Pageable pageable);

    Page<AuditLog> findByEntityTypeAndEntityId(String entityType, UUID entityId, Pageable pageable);

    Page<AuditLog> findByAction(String action, Pageable pageable);
}
