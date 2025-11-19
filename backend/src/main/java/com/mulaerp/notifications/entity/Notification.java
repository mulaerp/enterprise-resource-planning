package com.mulaerp.notifications.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class Notification extends BaseEntity {

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String type; // LOW_STOCK, ORDER_STATUS, PAYMENT_RECEIVED, etc.

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    private String referenceType; // PRODUCT, ORDER, INVOICE, etc.
    
    private String referenceId;

    @lombok.Builder.Default
    @Column(nullable = false)
    private Boolean isRead = false;

    private LocalDateTime readAt;

    @lombok.Builder.Default
    @Column(nullable = false)
    private String priority = "NORMAL"; // LOW, NORMAL, HIGH, URGENT
}
