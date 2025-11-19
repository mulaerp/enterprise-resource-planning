package com.mulaerp.company.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "companies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class Company extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(name = "tax_id")
    private String taxId;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(length = 3)
    private String currency = "USD";

    @Column(columnDefinition = "TEXT")
    private String logo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CompanyStatus status = CompanyStatus.ACTIVE;

    public enum CompanyStatus {
        ACTIVE, INACTIVE
    }
}
