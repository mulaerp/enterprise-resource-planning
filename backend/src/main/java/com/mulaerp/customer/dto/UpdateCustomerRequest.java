package com.mulaerp.customer.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCustomerRequest {
    
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

    /**
     * WP12: optimistic locking. Optional so existing callers that don't round-trip it (e.g. the
     * e2e suite) keep working unchanged; when present, CustomerService#updateCustomer compares it
     * against the freshly loaded entity's version and rejects a stale write with 409 before any
     * field is applied.
     */
    private Long version;
}
