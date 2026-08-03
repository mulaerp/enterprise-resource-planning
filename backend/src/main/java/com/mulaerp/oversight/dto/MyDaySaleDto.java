package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** One row of the drill-down sale list on {@link MyDayResponseDto#getSales()}. {@code total} is
 * the sale's {@code netCashAmount} (what the till actually moved for this sale, not the pre-
 * discount subtotal). {@code status} is COMPLETED or VOIDED - a voided sale still appears here
 * (for reconciliation/lookup) even though its value is excluded from every takings figure; see
 * {@link MyDayVoidedSalesDto}. */
public record MyDaySaleDto(
        String saleNumber,
        LocalDateTime time,
        BigDecimal total,
        String paymentMethod,
        String status
) {
}
