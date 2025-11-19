package com.mulaerp.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryReportDTO {
    private Long totalProducts;
    private Long lowStockProducts;
    private Long outOfStockProducts;
    private BigDecimal totalInventoryValue;
    private List<ProductStock> productStocks;
    private List<CategoryStock> categoryStocks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductStock {
        private String productId;
        private String sku;
        private String productName;
        private String category;
        private Integer stockQuantity;
        private Integer reorderLevel;
        private BigDecimal unitPrice;
        private BigDecimal stockValue;
        private String status; // IN_STOCK, LOW_STOCK, OUT_OF_STOCK
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryStock {
        private String category;
        private Long productCount;
        private Integer totalStock;
        private BigDecimal totalValue;
    }
}
