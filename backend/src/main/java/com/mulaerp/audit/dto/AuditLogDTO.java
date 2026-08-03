package com.mulaerp.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDTO {
    private UUID id;
    private String entityType;
    private UUID entityId;
    private String action;
    private String username;
    private String changeSummary;
    private LocalDateTime createdAt;
}
