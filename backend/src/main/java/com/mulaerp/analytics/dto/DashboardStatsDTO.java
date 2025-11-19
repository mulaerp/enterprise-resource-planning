package com.mulaerp.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDTO {
    private Long totalProducts;
    private Long totalCustomers;
    private Long totalSuppliers;
    private Long totalSalesOrders;
    private Long pendingSalesOrders;
    private Long confirmedSalesOrders;
    private BigDecimal totalRevenue;
    private BigDecimal monthlyRevenue;
    private Long lowStockProducts;
    private Long outOfStockProducts;
}
