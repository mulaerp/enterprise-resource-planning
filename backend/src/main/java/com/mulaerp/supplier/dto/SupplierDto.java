package com.mulaerp.supplier.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SupplierDto {
    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String taxId;
    private String paymentTerms;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
