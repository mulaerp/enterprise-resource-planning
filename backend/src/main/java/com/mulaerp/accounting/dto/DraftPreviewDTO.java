package com.mulaerp.accounting.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Preview of outstanding DRAFT journal entries in a date range, grouped by source (PoS Sale,
 * Invoice, Payment, Repair Job, Manual, ...) - backs GET
 * /accounting/journal-entries/drafts/preview, the read side of the audit-driven "post drafts"
 * fix (books reporting zero because every auto-journal hook posts DRAFT and the reports only
 * count POSTED entries). Never mutates anything - see AccountingService#postBatch for the write
 * side.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DraftPreviewDTO {
    private LocalDate startDate;
    private LocalDate endDate;
    private int totalCount;
    private BigDecimal totalDebits;
    private BigDecimal totalCredits;
    private List<SourceGroup> sources;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SourceGroup {
        private String source;
        private int count;
        private BigDecimal totalDebits;
        private BigDecimal totalCredits;
        private List<UUID> entryIds;
        private List<AccountSubtotal> accountSubtotals;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AccountSubtotal {
        private String accountCode;
        private String accountName;
        private BigDecimal debit;
        private BigDecimal credit;
    }
}
