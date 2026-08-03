package com.mulaerp.common.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @CreatedBy
    @Column(updatable = false)
    private String createdBy;
    
    @LastModifiedBy
    private String updatedBy;
    
    @lombok.Builder.Default
    @Column(nullable = false)
    private Boolean deleted = false;

    private LocalDateTime deletedAt;

    // WP12: optimistic locking. Hibernate manages this column automatically on every
    // INSERT/UPDATE (initializes to 0, increments on each successful UPDATE) and uses it as the
    // WHERE-clause guard so a stale in-memory entity can't silently overwrite a newer row.
    // Service-layer code additionally compares a client-submitted version against the freshly
    // loaded entity's version (see ProductService/CustomerService#update*) so a stale write from a
    // find-modify-save flow surfaces as 409 even though each request re-fetches the entity fresh.
    @Version
    @Column(nullable = false)
    private Long version;
}
