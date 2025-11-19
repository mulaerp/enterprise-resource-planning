package com.mulaerp.customer.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerDto {
    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String taxId;
    private BigDecimal creditLimit;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
