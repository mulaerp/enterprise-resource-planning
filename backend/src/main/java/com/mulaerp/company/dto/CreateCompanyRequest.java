package com.mulaerp.company.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCompanyRequest {
    @NotBlank(message = "Company name is required")
    private String name;

    private String taxId;

    private String address;

    private String phone;

    @Email(message = "Invalid email format")
    private String email;

    private String currency;

    private String logo;
}
