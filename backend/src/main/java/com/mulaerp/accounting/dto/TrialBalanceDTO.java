package com.mulaerp.accounting.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrialBalanceDTO {
    private List<TrialBalanceItem> items;
    private BigDecimal totalDebits;
    private BigDecimal totalCredits;
    private Boolean balanced;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrialBalanceItem {
        private String accountCode;
        private String accountName;
        private BigDecimal debit;
        private BigDecimal credit;
    }
}
