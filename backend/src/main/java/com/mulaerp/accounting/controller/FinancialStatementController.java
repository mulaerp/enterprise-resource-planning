package com.mulaerp.accounting.controller;

import com.mulaerp.accounting.dto.BalanceSheetDTO;
import com.mulaerp.accounting.dto.ProfitLossDTO;
import com.mulaerp.accounting.service.FinancialStatementExportService;
import com.mulaerp.accounting.service.FinancialStatementService;
import com.mulaerp.auth.security.RoleRules;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

// WP: five-role model - financial statements + their exports are ACCOUNTANT-and-up (RoleRules).
@RestController
@RequestMapping("/api/v1/accounting/reports")
@RequiredArgsConstructor
@PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
@Tag(name = "Financial Statements", description = "Profit & Loss and Balance Sheet reports")
public class FinancialStatementController {

    private final FinancialStatementService financialStatementService;
    private final FinancialStatementExportService financialStatementExportService;

    @GetMapping("/profit-loss")
    @Operation(summary = "Get profit & loss statement for a date range")
    public ResponseEntity<ProfitLossDTO> getProfitAndLoss(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(financialStatementService.getProfitAndLoss(startDate, endDate));
    }

    @GetMapping("/balance-sheet")
    @Operation(summary = "Get balance sheet as of a given date")
    public ResponseEntity<BalanceSheetDTO> getBalanceSheet(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate) {
        return ResponseEntity.ok(financialStatementService.getBalanceSheet(asOfDate));
    }

    @GetMapping("/profit-loss/export")
    @Operation(summary = "Export the profit & loss statement as PDF or CSV")
    public ResponseEntity<byte[]> exportProfitAndLoss(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "pdf") String format) {
        byte[] content = financialStatementExportService.exportProfitLoss(startDate, endDate, format);
        String filename = "profit-loss-" + startDate + "_" + endDate + "." + extension(format);
        return fileResponse(content, filename, format);
    }

    @GetMapping("/balance-sheet/export")
    @Operation(summary = "Export the balance sheet as PDF or CSV")
    public ResponseEntity<byte[]> exportBalanceSheet(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate,
            @RequestParam(defaultValue = "pdf") String format) {
        byte[] content = financialStatementExportService.exportBalanceSheet(asOfDate, format);
        String filename = "balance-sheet-" + asOfDate + "." + extension(format);
        return fileResponse(content, filename, format);
    }

    private String extension(String format) {
        return "csv".equalsIgnoreCase(format) ? "csv" : "pdf";
    }

    private ResponseEntity<byte[]> fileResponse(byte[] content, String filename, String format) {
        MediaType mediaType = "csv".equalsIgnoreCase(format)
                ? MediaType.parseMediaType("text/csv")
                : MediaType.APPLICATION_PDF;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(content);
    }
}
