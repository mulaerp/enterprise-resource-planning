package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One entry in an item's chronological trace timeline - see
 * {@link com.mulaerp.oversight.service.ItemTraceService}.
 *
 * @param type one of TRADE_IN_RECEIPT, PO_RECEIPT, OPENING_STOCK, STOCK_ADJUSTMENT,
 *             WAREHOUSE_TRANSFER_OUT, WAREHOUSE_TRANSFER_IN, RECOUNT, POS_SALE,
 *             REPAIR_PART_CONSUMED, WARRANTY_ISSUED, WARRANTY_CLAIMED, WARRANTY_VOID
 * @param quantity signed stock delta for movement-sourced events, null for warranty events
 * @param amount monetary value associated with the event (sale line total, trade-in payout,
 *               repair part cost), null when not applicable
 */
public record ItemTraceEventDto(
        LocalDateTime timestamp,
        String type,
        String documentNumber,
        String actor,
        Integer quantity,
        BigDecimal amount,
        String detail
) {
}
