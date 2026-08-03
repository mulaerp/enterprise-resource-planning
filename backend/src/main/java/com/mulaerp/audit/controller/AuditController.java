package com.mulaerp.audit.controller;

import com.mulaerp.audit.dto.AuditLogDTO;
import com.mulaerp.audit.service.AuditService;
import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.util.PageSizeCap;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

// WP: five-role model - MANAGER gets audit-log READ (branch oversight); ADMIN retains full audit.
@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
@PreAuthorize(RoleRules.MANAGER_UP)
@Tag(name = "Audit Logs", description = "Site-wide audit trail (WP5)")
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    @Operation(summary = "Search the audit trail, newest first")
    public ResponseEntity<Page<AuditLogDTO>> getAuditLogs(
            @RequestParam(required = false) String entityType,
            // PROBLEM 2 fix: lets a caller query one entity's full history (e.g.
            // ?entityType=Product&entityId=<id>) via the already-existing
            // AuditLogRepository#findByEntityTypeAndEntityId query surface.
            @RequestParam(required = false) UUID entityId,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("createdAt").descending());
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.atTime(LocalTime.MAX) : null;

        Page<AuditLogDTO> result = auditService.getAuditLogs(entityType, entityId, username, action, start, end, pageable);
        return ResponseEntity.ok(result);
    }
}
