package com.mulaerp.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalesReportDTO {
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private BigDecimal totalRevenue;
    private Long totalOrders;
    private BigDecimal averageOrderValue;
    private List<SalesByProduct> salesByProduct;
    private List<SalesByCustomer> salesByCustomer;
    private List<SalesByPeriod> salesByPeriod;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesByProduct {
        private String productId;
        private String productName;
        private Long quantitySold;
        private BigDecimal revenue;
        private BigDecimal percentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesByCustomer {
        private String customerId;
        private String customerName;
        private Long orderCount;
        private BigDecimal totalSpent;
        private BigDecimal percentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SalesByPeriod {
        private String period;
        private Long orderCount;
        private BigDecimal revenue;
    }
}
