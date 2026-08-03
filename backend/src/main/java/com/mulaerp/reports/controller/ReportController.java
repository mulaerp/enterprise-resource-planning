package com.mulaerp.reports.controller;

import com.mulaerp.reports.dto.InventoryReportDTO;
import com.mulaerp.reports.dto.SalesReportDTO;
import com.mulaerp.reports.service.ReportExportService;
import com.mulaerp.reports.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final ReportExportService reportExportService;

    @GetMapping("/sales")
    public ResponseEntity<SalesReportDTO> getSalesReport(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate
    ) {
        return ResponseEntity.ok(reportService.generateSalesReport(startDate, endDate));
    }

    @GetMapping("/inventory")
    public ResponseEntity<InventoryReportDTO> getInventoryReport() {
        return ResponseEntity.ok(reportService.generateInventoryReport());
    }

    @GetMapping("/sales/export")
    public ResponseEntity<byte[]> exportSalesReport(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
        @RequestParam(defaultValue = "csv") String format
    ) {
        byte[] content = reportExportService.exportSales(startDate, endDate, format);
        String filename = "sales-report-" + startDate.toLocalDate() + "_" + endDate.toLocalDate() + "." + extension(format);
        return fileResponse(content, filename, format);
    }

    @GetMapping("/inventory/export")
    public ResponseEntity<byte[]> exportInventoryReport(@RequestParam(defaultValue = "csv") String format) {
        byte[] content = reportExportService.exportInventory(format);
        String filename = "inventory-report." + extension(format);
        return fileResponse(content, filename, format);
    }

    private String extension(String format) {
        return "pdf".equalsIgnoreCase(format) ? "pdf" : "csv";
    }

    private ResponseEntity<byte[]> fileResponse(byte[] content, String filename, String format) {
        MediaType mediaType = "pdf".equalsIgnoreCase(format) ? MediaType.APPLICATION_PDF : MediaType.parseMediaType("text/csv");
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(content);
    }
}
