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
public class UpdateProductRequest {
    
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
    
    /**
     * Ignored by ProductService.updateProduct: stock can only move through the adjustment/
     * transfer paths so every change writes a StockMovement row. Kept on the request (and
     * optional, not @NotNull) so existing clients that still send it don't get a 400 for a
     * field the server deliberately discards.
     */
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

    /**
     * WP12: optimistic locking. Optional so existing callers that don't round-trip it (e.g. the
     * e2e suite) keep working unchanged; when present, ProductService#updateProduct compares it
     * against the freshly loaded entity's version and rejects a stale write with 409 before any
     * field is applied.
     */
    private Long version;
}
