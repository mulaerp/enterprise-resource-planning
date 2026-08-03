package com.mulaerp.oversight.dto;

import java.math.BigDecimal;

/** One payment method's slice of {@link MyDayResponseDto#getTakingsByPaymentMethod()} - COMPLETED
 * sales only, summed on {@code netCashAmount} (the same basis MoneyFlowService/CashUpService use),
 * never on {@code amountTendered} (which would double-count change given back on a CASH sale). */
public record MyDayPaymentMethodDto(
        String paymentMethod,
        BigDecimal amount,
        int saleCount
) {
}
