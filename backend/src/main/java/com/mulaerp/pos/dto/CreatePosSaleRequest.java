package com.mulaerp.pos.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePosSaleRequest {

    /** Offline-sync idempotency key - see PosSale Javadoc. */
    @NotBlank(message = "clientSaleId is required")
    private String clientSaleId;

    private UUID memberId;

    private String voucherCode;

    @NotBlank(message = "paymentMethod is required")
    private String paymentMethod;

    @PositiveOrZero(message = "amountTendered must not be negative")
    private BigDecimal amountTendered;

    // CRITICAL FIX 2: bean-level "not negative" guard - PosSaleService additionally checks this
    // (and lineDiscount) against a per-line cost floor so a discount can't be abused to sell below
    // cost, not just kept non-negative.
    @PositiveOrZero(message = "cartDiscount must not be negative")
    private BigDecimal cartDiscount;

    @NotEmpty(message = "At least one line is required")
    @Valid
    private List<PosSaleLineRequest> lines;

    /** WP: optional part-exchange - items the customer trades in against this sale, valued at the
     * credit rate (offeredCreditValue on each line), per the approved design decision. */
    @Valid
    private TradeInRequest tradeIn;

    /** WP: store credit to redeem against this sale (clamped to the amount owed; the member's
     * actual balance is enforced by MemberService#debitStoreCredit, which rejects an overdraft
     * with 400 rather than silently discarding the excess). */
    @DecimalMin(value = "0.0", inclusive = true, message = "storeCreditRedeemed must not be negative")
    private BigDecimal storeCreditRedeemed;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradeInRequest {

        @NotBlank(message = "tradeIn.clientTradeInId is required")
        private String clientTradeInId;

        /** BUGFIX: which of each line's two offered values is actually applied to this sale -
         * {@code CASH} uses {@code offeredCashValue}, {@code STORE_CREDIT} (the default when this
         * field is omitted, preserving the original credit-rate-only behaviour) uses
         * {@code offeredCreditValue}. The register only ever sends {@code CASH} when the operator
         * explicitly selected it in the trade-in payout dropdown before "Add to Cart" - see
         * PosSaleService#createSale, which must honour this instead of silently forcing the credit
         * rate, so the register's displayed applied value always matches what the sale posts. */
        private String payoutType;

        @NotEmpty(message = "tradeIn.lines must have at least one line")
        @Valid
        private List<CreatePosTradeInRequest.TradeInLineRequest> lines;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PosSaleLineRequest {

        @NotNull(message = "productId is required")
        private UUID productId;

        @NotNull(message = "quantity is required")
        @Min(value = 1, message = "quantity must be at least 1")
        private Integer quantity;

        @NotNull(message = "unitPrice is required")
        @DecimalMin(value = "0.0", inclusive = true, message = "unitPrice must be positive")
        private BigDecimal unitPrice;

        @DecimalMin(value = "0.0", inclusive = true, message = "lineDiscount must be positive")
        private BigDecimal lineDiscount;
    }
}
