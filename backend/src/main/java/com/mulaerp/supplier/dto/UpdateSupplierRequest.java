package com.mulaerp.supplier.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSupplierRequest {
    
    @NotBlank(message = "Supplier name is required")
    @Size(max = 255, message = "Supplier name must not exceed 255 characters")
    private String name;
    
    @Email(message = "Invalid email format")
    private String email;
    
    private String phone;
    
    private String address;
    
    private String taxId;
    
    private String paymentTerms;
    
    @NotBlank(message = "Status is required")
    private String status;
}
