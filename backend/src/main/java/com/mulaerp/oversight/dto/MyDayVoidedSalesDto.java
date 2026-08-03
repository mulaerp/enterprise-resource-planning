package com.mulaerp.oversight.dto;

import java.math.BigDecimal;

/** Sales originally rung up by this cashier on this day that were subsequently voided (by a
 * MANAGER/ADMIN - a cashier can never void their own sale, see the {@code pos} skill). Already
 * excluded from {@link MyDayResponseDto#getGrossTakings()}/{@code takingsByPaymentMethod}/
 * {@code expectedCashInDrawer} - this is the "it happened, here's why" visibility line, mirroring
 * the oversight exceptions module's "voided sales" section. {@code value} is the voided sale's own
 * {@code netCashAmount} at the time it was rung up (pre-void). */
public record MyDayVoidedSalesDto(
        int count,
        BigDecimal value
) {
}
