package com.mulaerp.analytics.service;

import com.mulaerp.analytics.dto.DashboardStatsDTO;
import com.mulaerp.analytics.dto.SalesChartDataDTO;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.sales.entity.SalesOrder;
import com.mulaerp.sales.repository.SalesOrderRepository;
import com.mulaerp.supplier.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;
    private final SalesOrderRepository salesOrderRepository;

    public DashboardStatsDTO getDashboardStats() {
        Long totalProducts = productRepository.count();
        Long totalCustomers = customerRepository.count();
        Long totalSuppliers = supplierRepository.count();
        Long totalSalesOrders = salesOrderRepository.count();
        
        Long pendingSalesOrders = salesOrderRepository.countByStatus(SalesOrder.OrderStatus.DRAFT);
        Long confirmedSalesOrders = salesOrderRepository.countByStatus(SalesOrder.OrderStatus.CONFIRMED);
        
        BigDecimal totalRevenue = salesOrderRepository.findAll().stream()
            .filter(order -> "CONFIRMED".equals(order.getStatus()) || "DELIVERED".equals(order.getStatus()))
            .map(SalesOrder::getTotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
        BigDecimal monthlyRevenue = salesOrderRepository.findAll().stream()
            .filter(order -> order.getOrderDate().isAfter(startOfMonth))
            .filter(order -> "CONFIRMED".equals(order.getStatus()) || "DELIVERED".equals(order.getStatus()))
            .map(SalesOrder::getTotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        Long lowStockProducts = productRepository.findAll().stream()
            .filter(p -> p.getStockQuantity() <= p.getReorderLevel() && p.getStockQuantity() > 0)
            .count();
        
        Long outOfStockProducts = productRepository.findAll().stream()
            .filter(p -> p.getStockQuantity() == 0)
            .count();

        return DashboardStatsDTO.builder()
            .totalProducts(totalProducts)
            .totalCustomers(totalCustomers)
            .totalSuppliers(totalSuppliers)
            .totalSalesOrders(totalSalesOrders)
            .pendingSalesOrders(pendingSalesOrders)
            .confirmedSalesOrders(confirmedSalesOrders)
            .totalRevenue(totalRevenue)
            .monthlyRevenue(monthlyRevenue)
            .lowStockProducts(lowStockProducts)
            .outOfStockProducts(outOfStockProducts)
            .build();
    }

    public SalesChartDataDTO getSalesChartData(int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        List<SalesOrder> recentOrders = salesOrderRepository.findAll().stream()
            .filter(order -> order.getOrderDate().isAfter(startDate))
            .filter(order -> "CONFIRMED".equals(order.getStatus()) || "DELIVERED".equals(order.getStatus()))
            .collect(Collectors.toList());

        // Daily sales for the last N days
        List<SalesChartDataDTO.ChartDataPoint> dailySales = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd");
        
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();
            
            BigDecimal dayTotal = recentOrders.stream()
                .filter(order -> order.getOrderDate().isAfter(date.minusDays(1)) && order.getOrderDate().isBefore(date.plusDays(1)))
                .map(SalesOrder::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            Long dayCount = recentOrders.stream()
                .filter(order -> order.getOrderDate().isAfter(date.minusDays(1)) && order.getOrderDate().isBefore(date.plusDays(1)))
                .count();
            
            dailySales.add(SalesChartDataDTO.ChartDataPoint.builder()
                .label(date.format(formatter))
                .value(dayTotal)
                .count(dayCount)
                .build());
        }

        return SalesChartDataDTO.builder()
            .dailySales(dailySales)
            .monthlySales(new ArrayList<>())
            .topProducts(new ArrayList<>())
            .topCustomers(new ArrayList<>())
            .build();
    }
}
