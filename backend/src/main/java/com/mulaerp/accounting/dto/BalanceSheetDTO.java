package com.mulaerp.accounting.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BalanceSheetDTO {
    private LocalDate asOfDate;
    private List<FinancialLineItemDTO> assets;
    private List<FinancialLineItemDTO> liabilities;
    private List<FinancialLineItemDTO> equity;
    private BigDecimal totalAssets;
    private BigDecimal totalLiabilities;
    private BigDecimal totalEquity;
    private BigDecimal retainedEarnings;
    /** Count of DRAFT journal entries dated on or before asOfDate - deliberately excluded from the
     * figures above (only POSTED activity is counted). Lets the UI show an "N unposted entries
     * excluded" advisory rather than silently under-reporting. */
    private long draftEntriesInPeriod;
}
