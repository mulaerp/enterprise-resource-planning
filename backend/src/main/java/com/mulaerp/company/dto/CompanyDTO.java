package com.mulaerp.company.dto;

import com.mulaerp.company.entity.Company;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompanyDTO {
    private UUID id;
    private String name;
    private String taxId;
    private String address;
    private String phone;
    private String email;
    private String currency;
    private String logo;
    private Company.CompanyStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
