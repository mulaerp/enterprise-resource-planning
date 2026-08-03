package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.util.List;

public record CashierTotalsDto(
        String cashier,
        int count,
        BigDecimal gross,
        BigDecimal average,
        BigDecimal discountRate,
        List<String> documents
) {
}
