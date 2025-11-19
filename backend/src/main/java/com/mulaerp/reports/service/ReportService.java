package com.mulaerp.reports.service;

import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.reports.dto.InventoryReportDTO;
import com.mulaerp.reports.dto.SalesReportDTO;
import com.mulaerp.sales.entity.SalesOrder;
import com.mulaerp.sales.entity.SalesOrderItem;
import com.mulaerp.sales.repository.SalesOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final SalesOrderRepository salesOrderRepository;
    private final ProductRepository productRepository;

    public SalesReportDTO generateSalesReport(LocalDateTime startDate, LocalDateTime endDate) {
        List<SalesOrder> orders = salesOrderRepository.findAll().stream()
            .filter(order -> order.getOrderDate().isAfter(startDate.toLocalDate()) && order.getOrderDate().isBefore(endDate.toLocalDate()))
            .filter(order -> "CONFIRMED".equals(order.getStatus()) || "DELIVERED".equals(order.getStatus()))
            .collect(Collectors.toList());

        BigDecimal totalRevenue = orders.stream()
            .map(SalesOrder::getTotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Long totalOrders = (long) orders.size();
        BigDecimal averageOrderValue = totalOrders > 0 
            ? totalRevenue.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        // Sales by product
        Map<String, SalesReportDTO.SalesByProduct> productSales = new HashMap<>();
        for (SalesOrder order : orders) {
            for (SalesOrderItem item : order.getItems()) {
                String productId = item.getProduct().getId().toString();
                String productName = item.getProduct().getName();
                
                productSales.compute(productId, (k, v) -> {
                    if (v == null) {
                        return SalesReportDTO.SalesByProduct.builder()
                            .productId(productId)
                            .productName(productName)
                            .quantitySold((long) item.getQuantity())
                            .revenue(item.getTotal())
                            .build();
                    } else {
                        v.setQuantitySold(v.getQuantitySold() + item.getQuantity());
                        v.setRevenue(v.getRevenue().add(item.getTotal()));
                        return v;
                    }
                });
            }
        }

        // Calculate percentages
        List<SalesReportDTO.SalesByProduct> salesByProduct = productSales.values().stream()
            .peek(p -> {
                if (totalRevenue.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal percentage = p.getRevenue()
                        .divide(totalRevenue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                    p.setPercentage(percentage);
                }
            })
            .sorted((a, b) -> b.getRevenue().compareTo(a.getRevenue()))
            .collect(Collectors.toList());

        // Sales by customer
        Map<String, SalesReportDTO.SalesByCustomer> customerSales = new HashMap<>();
        for (SalesOrder order : orders) {
            String customerId = order.getCustomer().getId().toString();
            String customerName = order.getCustomer().getName();
            
            customerSales.compute(customerId, (k, v) -> {
                if (v == null) {
                    return SalesReportDTO.SalesByCustomer.builder()
                        .customerId(customerId)
                        .customerName(customerName)
                        .orderCount(1L)
                        .totalSpent(order.getTotal())
                        .build();
                } else {
                    v.setOrderCount(v.getOrderCount() + 1);
                    v.setTotalSpent(v.getTotalSpent().add(order.getTotal()));
                    return v;
                }
            });
        }

        List<SalesReportDTO.SalesByCustomer> salesByCustomer = customerSales.values().stream()
            .peek(c -> {
                if (totalRevenue.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal percentage = c.getTotalSpent()
                        .divide(totalRevenue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                    c.setPercentage(percentage);
                }
            })
            .sorted((a, b) -> b.getTotalSpent().compareTo(a.getTotalSpent()))
            .collect(Collectors.toList());

        // Sales by period (daily)
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, SalesReportDTO.SalesByPeriod> periodSales = new TreeMap<>();
        for (SalesOrder order : orders) {
            String period = order.getOrderDate().format(formatter);
            
            periodSales.compute(period, (k, v) -> {
                if (v == null) {
                    return SalesReportDTO.SalesByPeriod.builder()
                        .period(period)
                        .orderCount(1L)
                        .revenue(order.getTotal())
                        .build();
                } else {
                    v.setOrderCount(v.getOrderCount() + 1);
                    v.setRevenue(v.getRevenue().add(order.getTotal()));
                    return v;
                }
            });
        }

        return SalesReportDTO.builder()
            .startDate(startDate)
            .endDate(endDate)
            .totalRevenue(totalRevenue)
            .totalOrders(totalOrders)
            .averageOrderValue(averageOrderValue)
            .salesByProduct(salesByProduct)
            .salesByCustomer(salesByCustomer)
            .salesByPeriod(new ArrayList<>(periodSales.values()))
            .build();
    }

    public InventoryReportDTO generateInventoryReport() {
        List<Product> products = productRepository.findAll();

        Long totalProducts = (long) products.size();
        Long lowStockProducts = products.stream()
            .filter(p -> p.getStockQuantity() <= p.getReorderLevel() && p.getStockQuantity() > 0)
            .count();
        Long outOfStockProducts = products.stream()
            .filter(p -> p.getStockQuantity() == 0)
            .count();

        BigDecimal totalInventoryValue = products.stream()
            .map(p -> p.getUnitPrice().multiply(BigDecimal.valueOf(p.getStockQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<InventoryReportDTO.ProductStock> productStocks = products.stream()
            .map(p -> {
                String status;
                if (p.getStockQuantity() == 0) {
                    status = "OUT_OF_STOCK";
                } else if (p.getStockQuantity() <= p.getReorderLevel()) {
                    status = "LOW_STOCK";
                } else {
                    status = "IN_STOCK";
                }

                return InventoryReportDTO.ProductStock.builder()
                    .productId(p.getId().toString())
                    .sku(p.getSku())
                    .productName(p.getName())
                    .category(p.getCategory() != null ? p.getCategory().getName() : "Uncategorized")
                    .stockQuantity(p.getStockQuantity())
                    .reorderLevel(p.getReorderLevel())
                    .unitPrice(p.getUnitPrice())
                    .stockValue(p.getUnitPrice().multiply(BigDecimal.valueOf(p.getStockQuantity())))
                    .status(status)
                    .build();
            })
            .sorted((a, b) -> a.getStatus().compareTo(b.getStatus()))
            .collect(Collectors.toList());

        // Group by category
        Map<String, InventoryReportDTO.CategoryStock> categoryMap = new HashMap<>();
        for (Product p : products) {
            String category = p.getCategory() != null ? p.getCategory().getName() : "Uncategorized";
            
            categoryMap.compute(category, (k, v) -> {
                if (v == null) {
                    return InventoryReportDTO.CategoryStock.builder()
                        .category(category)
                        .productCount(1L)
                        .totalStock(p.getStockQuantity())
                        .totalValue(p.getUnitPrice().multiply(BigDecimal.valueOf(p.getStockQuantity())))
                        .build();
                } else {
                    v.setProductCount(v.getProductCount() + 1);
                    v.setTotalStock(v.getTotalStock() + p.getStockQuantity());
                    v.setTotalValue(v.getTotalValue().add(
                        p.getUnitPrice().multiply(BigDecimal.valueOf(p.getStockQuantity()))
                    ));
                    return v;
                }
            });
        }

        List<InventoryReportDTO.CategoryStock> categoryStocks = new ArrayList<>(categoryMap.values());
        categoryStocks.sort((a, b) -> b.getTotalValue().compareTo(a.getTotalValue()));

        return InventoryReportDTO.builder()
            .totalProducts(totalProducts)
            .lowStockProducts(lowStockProducts)
            .outOfStockProducts(outOfStockProducts)
            .totalInventoryValue(totalInventoryValue)
            .productStocks(productStocks)
            .categoryStocks(categoryStocks)
            .build();
    }
}
