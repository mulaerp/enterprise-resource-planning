package com.mulaerp.pos.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Standalone trade-in purchase request - POST /api/v1/pos/trade-ins. payoutType here is always
 * CASH or STORE_CREDIT (APPLIED_TO_SALE is only ever created internally by PosSaleService as part
 * of a part-exchange sale - see PosTradeInService#createEmbeddedForSale). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePosTradeInRequest {

    /** Offline-sync idempotency key - see PosTradeIn Javadoc. */
    @NotBlank(message = "clientTradeInId is required")
    private String clientTradeInId;

    private UUID memberId;

    @NotBlank(message = "payoutType is required")
    private String payoutType;

    @NotEmpty(message = "At least one line is required")
    @Valid
    private List<TradeInLineRequest> lines;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradeInLineRequest {

        @NotBlank(message = "description is required")
        private String description;

        private String condition;

        private String accessories;

        private Boolean hasBox;

        @NotNull(message = "offeredCashValue is required")
        @DecimalMin(value = "0.0", inclusive = true, message = "offeredCashValue must not be negative")
        private BigDecimal offeredCashValue;

        @NotNull(message = "offeredCreditValue is required")
        @DecimalMin(value = "0.0", inclusive = true, message = "offeredCreditValue must not be negative")
        private BigDecimal offeredCreditValue;

        /** V38: an already-existing catalogue product this line should link to (typically a
         * GET /pos/trade-ins/suggest candidate the cashier picked) - see PosTradeInService. When
         * set, no new Product is created; that product's stock/acquisitionCost are updated instead. */
        private UUID productId;

        /** V38: required by PosTradeInService when productId is absent (an unlinked, free-text
         * item) so a brand-new product is never left uncategorised - ignored when productId is set. */
        private UUID categoryId;
    }
}
