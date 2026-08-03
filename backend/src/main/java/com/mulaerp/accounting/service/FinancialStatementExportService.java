package com.mulaerp.accounting.service;

import com.mulaerp.accounting.dto.BalanceSheetDTO;
import com.mulaerp.accounting.dto.FinancialLineItemDTO;
import com.mulaerp.accounting.dto.ProfitLossDTO;
import com.mulaerp.common.export.PdfReportUtil;
import com.mulaerp.company.service.CompanyNameResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Server-side PDF/CSV export of the Profit &amp; Loss and Balance Sheet statements (WP5). Reuses
 * {@link FinancialStatementService} for the numbers; these documents are meant for LHDN/audit
 * submission, so they're deliberately plain - company name, report title, period, generated-at
 * timestamp, and the same line items shown in the app.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinancialStatementExportService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final FinancialStatementService financialStatementService;
    private final CompanyNameResolver companyNameResolver;

    public byte[] exportProfitLoss(LocalDate startDate, LocalDate endDate, String format) {
        ProfitLossDTO dto = financialStatementService.getProfitAndLoss(startDate, endDate);

        List<String> headers = List.of("Account Code", "Account Name", "Amount");
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("", "Revenue", ""));
        for (FinancialLineItemDTO li : dto.getRevenue()) {
            rows.add(List.of(li.getAccountCode(), li.getAccountName(), PdfReportUtil.money(li.getAmount())));
        }
        rows.add(List.of("", "Total Revenue", PdfReportUtil.money(dto.getTotalRevenue())));
        rows.add(List.of("", "Expenses", ""));
        for (FinancialLineItemDTO li : dto.getExpenses()) {
            rows.add(List.of(li.getAccountCode(), li.getAccountName(), PdfReportUtil.money(li.getAmount())));
        }
        rows.add(List.of("", "Total Expenses", PdfReportUtil.money(dto.getTotalExpenses())));

        List<String> totals = List.of("", "Net Income", PdfReportUtil.money(dto.getNetIncome()));
        String period = "Period: " + startDate.format(DATE_FORMAT) + " to " + endDate.format(DATE_FORMAT);

        return render(headers, rows, totals, "Profit & Loss Statement", period, format);
    }

    public byte[] exportBalanceSheet(LocalDate asOfDate, String format) {
        BalanceSheetDTO dto = financialStatementService.getBalanceSheet(asOfDate);

        List<String> headers = List.of("Account Code", "Account Name", "Amount");
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("", "Assets", ""));
        for (FinancialLineItemDTO li : dto.getAssets()) {
            rows.add(List.of(li.getAccountCode(), li.getAccountName(), PdfReportUtil.money(li.getAmount())));
        }
        rows.add(List.of("", "Total Assets", PdfReportUtil.money(dto.getTotalAssets())));
        rows.add(List.of("", "Liabilities", ""));
        for (FinancialLineItemDTO li : dto.getLiabilities()) {
            rows.add(List.of(li.getAccountCode(), li.getAccountName(), PdfReportUtil.money(li.getAmount())));
        }
        rows.add(List.of("", "Total Liabilities", PdfReportUtil.money(dto.getTotalLiabilities())));
        rows.add(List.of("", "Equity", ""));
        for (FinancialLineItemDTO li : dto.getEquity()) {
            rows.add(List.of(li.getAccountCode(), li.getAccountName(), PdfReportUtil.money(li.getAmount())));
        }
        if (dto.getRetainedEarnings() != null) {
            rows.add(List.of("", "Retained Earnings", PdfReportUtil.money(dto.getRetainedEarnings())));
        }
        rows.add(List.of("", "Total Equity", PdfReportUtil.money(dto.getTotalEquity())));

        List<String> totals = List.of("", "Total Liabilities + Equity",
                PdfReportUtil.money(dto.getTotalLiabilities().add(dto.getTotalEquity())));
        String period = "As of: " + asOfDate.format(DATE_FORMAT);

        return render(headers, rows, totals, "Balance Sheet", period, format);
    }

    private byte[] render(List<String> headers, List<List<String>> rows, List<String> totals,
                           String title, String period, String format) {
        if ("csv".equalsIgnoreCase(format)) {
            return PdfReportUtil.buildCsv(headers, rows, totals);
        }
        try {
            return PdfReportUtil.buildTableReport(companyNameResolver.resolveName(), title, period, headers, rows, totals);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to generate " + title + " PDF", e);
        }
    }
}
