package com.mulaerp.accounting.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * A single account line on a financial statement (P&L or balance sheet),
 * normalised so the amount is positive when the account is in its normal balance position.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FinancialLineItemDTO {
    private String accountCode;
    private String accountName;
    private BigDecimal amount;
}
