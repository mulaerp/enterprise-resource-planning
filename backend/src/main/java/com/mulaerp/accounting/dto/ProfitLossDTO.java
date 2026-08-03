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
public class ProfitLossDTO {
    private LocalDate startDate;
    private LocalDate endDate;
    private List<FinancialLineItemDTO> revenue;
    private List<FinancialLineItemDTO> expenses;
    private BigDecimal totalRevenue;
    private BigDecimal totalExpenses;
    private BigDecimal netIncome;
    /** Count of DRAFT journal entries dated within [startDate, endDate] - deliberately excluded
     * from the figures above (only POSTED activity is counted). Lets the UI show an "N unposted
     * entries excluded" advisory rather than silently under-reporting. */
    private long draftEntriesInPeriod;
}
