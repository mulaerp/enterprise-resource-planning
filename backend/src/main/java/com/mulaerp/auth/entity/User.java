package com.mulaerp.auth.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Column(nullable = false)
    private String passwordHash;
    
    @Column(nullable = false)
    private String fullName;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role = UserRole.CASHIER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    // WP: five-role model. USER was renamed/repurposed to CASHIER (data-migrated in V27); ACCOUNTANT
    // and INVENTORY are new. See RoleRules for the full @PreAuthorize matrix these map to.
    public enum UserRole {
        ADMIN, MANAGER, ACCOUNTANT, INVENTORY, CASHIER
    }
    
    public enum UserStatus {
        ACTIVE, INACTIVE, SUSPENDED
    }
}
