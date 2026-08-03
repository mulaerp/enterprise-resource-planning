package com.mulaerp.banking.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BankSummaryDTO {
    private long unreconciledCount;
    private long reconciledCount;
    private BigDecimal unreconciledTotal;
}
