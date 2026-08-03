package com.mulaerp.oversight.dto;

import java.time.LocalDate;
import java.util.List;

/** GET /api/v1/oversight/exceptions response - see {@link com.mulaerp.oversight.service.ExceptionsService}. */
public record ExceptionsResponseDto(
        LocalDate from,
        LocalDate to,
        int deepDiscountThresholdPercent,
        List<DeepDiscountSaleDto> deepDiscountSales,
        List<PriceFloorSaleLineDto> nearPriceFloorSales,
        int unpostedDraftJournalCount,
        List<String> unpostedDraftJournalIds,
        long unreconciledBankTransactionCount,
        List<String> unreconciledBankTransactionReferences,
        int staleRepairJobThresholdDays,
        List<StaleRepairJobDto> staleRepairJobs,
        List<CashierTotalsDto> cashierTotals,
        /** V34: sales voided within the period (by voidedAt, not the original sale date). */
        int voidedSaleCount,
        List<VoidedSaleDto> voidedSales
) {
}
