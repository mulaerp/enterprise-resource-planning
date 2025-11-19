package com.mulaerp.notifications.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDTO {
    private String id;
    private String type;
    private String title;
    private String message;
    private String referenceType;
    private String referenceId;
    private Boolean isRead;
    private LocalDateTime readAt;
    private String priority;
    private LocalDateTime createdAt;
}
