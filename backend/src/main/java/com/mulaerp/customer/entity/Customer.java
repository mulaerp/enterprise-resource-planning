package com.mulaerp.customer.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Customer extends BaseEntity {
    
    @Column(nullable = false)
    private String name;
    
    private String email;
    
    private String phone;
    
    @Column(columnDefinition = "TEXT")
    private String address;
    
    @Column(length = 100)
    private String taxId;
    
    @Column(precision = 15, scale = 2)
    private BigDecimal creditLimit = BigDecimal.ZERO;
    
    @Column(nullable = false, length = 50)
    private String status = "ACTIVE";
}
