package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** GET /api/v1/oversight/money-flow response - see {@link com.mulaerp.oversight.service.MoneyFlowService}. */
public record MoneyFlowResponseDto(
        LocalDate from,
        LocalDate to,
        List<PaymentMethodTakingsDto> takingsByMethod,
        AmountWithDocumentsDto tradeInCashPayouts,
        AmountWithDocumentsDto storeCreditIssued,
        AmountWithDocumentsDto storeCreditRedeemed,
        AmountWithDocumentsDto serviceRevenue,
        AmountWithDocumentsDto posGoodsRevenue,
        BigDecimal totalRevenue,
        AmountWithDocumentsDto cogsGoods,
        AmountWithDocumentsDto cogsRepairParts,
        BigDecimal totalCogs,
        BigDecimal grossMargin,
        BigDecimal netCashMovement,
        PostedJournalCrossCheckDto postedJournalCrossCheck
) {
}
