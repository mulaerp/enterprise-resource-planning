package com.mulaerp.supplier.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "suppliers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Supplier extends BaseEntity {
    
    @Column(nullable = false)
    private String name;
    
    private String email;
    
    private String phone;
    
    @Column(columnDefinition = "TEXT")
    private String address;
    
    @Column(length = 100)
    private String taxId;
    
    @Column(length = 100)
    private String paymentTerms;
    
    @Column(nullable = false, length = 50)
    private String status = "ACTIVE";
}
