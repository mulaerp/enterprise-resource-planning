package com.mulaerp.reports.service;

import com.mulaerp.common.export.PdfReportUtil;
import com.mulaerp.company.service.CompanyNameResolver;
import com.mulaerp.reports.dto.InventoryReportDTO;
import com.mulaerp.reports.dto.SalesReportDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Server-side PDF/CSV export of the sales and inventory reports (WP5), reusing {@link
 * ReportService} for the numbers - same param shapes as the existing JSON endpoints in {@code
 * ReportController}.
 */
@Service
@RequiredArgsConstructor
public class ReportExportService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final ReportService reportService;
    private final CompanyNameResolver companyNameResolver;

    public byte[] exportSales(LocalDateTime startDate, LocalDateTime endDate, String format) {
        SalesReportDTO dto = reportService.generateSalesReport(startDate, endDate);

        List<String> headers = List.of("Product", "Quantity Sold", "Revenue", "% of Revenue");
        List<List<String>> rows = dto.getSalesByProduct().stream()
                .map(p -> List.of(
                        p.getProductName(),
                        String.valueOf(p.getQuantitySold()),
                        PdfReportUtil.money(p.getRevenue()),
                        p.getPercentage() == null ? "" : p.getPercentage().setScale(1, java.math.RoundingMode.HALF_UP) + "%"))
                .collect(Collectors.toList());
        List<String> totals = List.of("Total", String.valueOf(dto.getTotalOrders()), PdfReportUtil.money(dto.getTotalRevenue()), "");

        String period = "Period: " + startDate.toLocalDate().format(DATE_FORMAT) + " to " + endDate.toLocalDate().format(DATE_FORMAT)
                + " | Orders: " + dto.getTotalOrders() + " | Avg order value: " + PdfReportUtil.money(dto.getAverageOrderValue());

        return render(headers, rows, totals, "Sales Report", period, format);
    }

    public byte[] exportInventory(String format) {
        InventoryReportDTO dto = reportService.generateInventoryReport();

        List<String> headers = List.of("SKU", "Product", "Category", "Stock", "Reorder Level", "Unit Price", "Stock Value", "Status");
        List<List<String>> rows = dto.getProductStocks().stream()
                .map(p -> List.of(
                        p.getSku(),
                        p.getProductName(),
                        p.getCategory() == null ? "" : p.getCategory(),
                        String.valueOf(p.getStockQuantity()),
                        String.valueOf(p.getReorderLevel()),
                        PdfReportUtil.money(p.getUnitPrice()),
                        PdfReportUtil.money(p.getStockValue()),
                        p.getStatus()))
                .collect(Collectors.toList());

        String period = "Total products: " + dto.getTotalProducts()
                + " | Total value: " + PdfReportUtil.money(dto.getTotalInventoryValue())
                + " | Low stock: " + dto.getLowStockProducts()
                + " | Out of stock: " + dto.getOutOfStockProducts();

        return render(headers, rows, null, "Inventory Report", period, format);
    }

    private byte[] render(List<String> headers, List<List<String>> rows, List<String> totals,
                           String title, String period, String format) {
        if (!"pdf".equalsIgnoreCase(format)) {
            return PdfReportUtil.buildCsv(headers, rows, totals);
        }
        try {
            return PdfReportUtil.buildTableReport(companyNameResolver.resolveName(), title, period, headers, rows, totals);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to generate " + title + " PDF", e);
        }
    }
}
