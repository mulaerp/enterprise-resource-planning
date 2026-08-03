package com.mulaerp.oversight.dto;

import java.math.BigDecimal;

/** Repair payments (any method, deposit/balance/full) this cashier personally collected on the
 * day - excludes refund rows entirely (see {@link MyDayResponseDto} javadoc; a CASH refund is
 * netted into {@code expectedCashInDrawer} separately, not counted here as a "collection"). Zero
 * for a cashier who never touches the repair module day-to-day - included unconditionally so the
 * frontend can simply hide the card when {@code count == 0}. */
public record MyDayRepairPaymentsDto(
        int count,
        BigDecimal value
) {
}
