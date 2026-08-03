package com.mulaerp.product.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {
    private UUID id;
    private String sku;
    private String name;
    private String description;
    private UUID categoryId;
    private String categoryName;
    private BigDecimal unitPrice;
    private BigDecimal costPrice;
    private Integer stockQuantity;
    private Integer reorderLevel;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long version;

    // --- Thrift-store fields (WP: PoS flagship feature) ---------------------------------
    private String condition;
    private BigDecimal acquisitionCost;
    private List<String> tags;
    private String accessories;
    private Boolean hasBox;

    // --- REPAIR/WARRANTY + public storefront fields -------------------------------------
    private Integer warrantyMonths;
    private BigDecimal buyPrice;

    // --- Product images (WP: zero-copyright product photos) -----------------------------
    /** Public GET path (e.g. "/api/v1/public/images/{filename}"), or null if no photo uploaded. */
    private String imageUrl;
}
