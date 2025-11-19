package com.mulaerp.customer.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateCustomerRequest {
    
    @NotBlank(message = "Customer name is required")
    @Size(max = 255, message = "Customer name must not exceed 255 characters")
    private String name;
    
    @Email(message = "Invalid email format")
    private String email;
    
    private String phone;
    
    private String address;
    
    private String taxId;
    
    @DecimalMin(value = "0.0", inclusive = true, message = "Credit limit must be positive")
    private BigDecimal creditLimit;
    
    @NotBlank(message = "Status is required")
    private String status;
}
