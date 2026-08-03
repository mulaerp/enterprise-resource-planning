package com.mulaerp.product.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateProductRequest {
    
    @NotBlank(message = "SKU is required")
    @Size(max = 100, message = "SKU must not exceed 100 characters")
    private String sku;
    
    @NotBlank(message = "Product name is required")
    @Size(max = 255, message = "Product name must not exceed 255 characters")
    private String name;
    
    private String description;
    
    private UUID categoryId;
    
    @NotNull(message = "Unit price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Unit price must be positive")
    private BigDecimal unitPrice;
    
    @NotNull(message = "Cost price is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Cost price must be positive")
    private BigDecimal costPrice;
    
    @NotNull(message = "Stock quantity is required")
    @Min(value = 0, message = "Stock quantity must be positive")
    private Integer stockQuantity;
    
    @NotNull(message = "Reorder level is required")
    @Min(value = 0, message = "Reorder level must be positive")
    private Integer reorderLevel;
    
    @NotBlank(message = "Status is required")
    private String status;

    // --- Thrift-store fields (WP: PoS flagship feature) - all optional -------------------
    private String condition;

    @DecimalMin(value = "0.0", inclusive = true, message = "Acquisition cost must be positive")
    private BigDecimal acquisitionCost;

    private List<String> tags;

    private String accessories;

    private Boolean hasBox;

    // --- REPAIR/WARRANTY + public storefront fields - both optional --------------------
    @Min(value = 0, message = "Warranty months must be positive")
    private Integer warrantyMonths;

    @DecimalMin(value = "0.0", inclusive = true, message = "Buy price must be positive")
    private BigDecimal buyPrice;
}
