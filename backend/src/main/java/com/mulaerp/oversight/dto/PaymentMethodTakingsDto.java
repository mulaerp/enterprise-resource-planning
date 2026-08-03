package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.util.List;

/** Takings for one payment method, combining PoS sales and repair payments - part of {@link MoneyFlowResponseDto}. */
public record PaymentMethodTakingsDto(
        String paymentMethod,
        BigDecimal posSalesAmount,
        int posSalesCount,
        BigDecimal repairPaymentsAmount,
        int repairPaymentsCount,
        BigDecimal total,
        List<String> documents
) {
}
