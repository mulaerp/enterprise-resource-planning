package com.mulaerp.oversight.dto;

import java.math.BigDecimal;

/** Trade-ins (standalone + part-exchange) created by this cashier on the day - see
 * {@link MyDayResponseDto#getTradeInsProcessed()}. {@code cashPaidOut}/{@code storeCreditIssued}
 * only ever reflect payoutType CASH/STORE_CREDIT respectively; a part-exchange trade-in
 * (payoutType APPLIED_TO_SALE) counts toward {@code count} but contributes to neither, since its
 * value nets directly into the sale's own takings instead of paying out separately. */
public record MyDayTradeInSummaryDto(
        int count,
        BigDecimal cashPaidOut,
        BigDecimal storeCreditIssued
) {
}
