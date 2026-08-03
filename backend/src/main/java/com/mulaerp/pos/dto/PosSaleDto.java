package com.mulaerp.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PosSaleDto {
    private UUID id;
    private String saleNumber;
    private String clientSaleId;
    private UUID memberId;
    private String voucherCode;
    private String paymentMethod;
    private BigDecimal subtotal;
    private BigDecimal discountTotal;
    private BigDecimal total;
    private BigDecimal amountTendered;
    private BigDecimal change;
    private Integer pointsEarned;
    private List<PosSaleLineDto> lines;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** PROBLEM 2 fix: the cashier who rang up the sale - column already populated by JPA
     * auditing (BaseEntity#createdBy), just wasn't surfaced on this DTO. */
    private String createdBy;

    // --- Part-exchange (WP) --------------------------------------------------------------
    private UUID tradeInId;
    private BigDecimal tradeInValueApplied;
    private BigDecimal storeCreditRedeemed;
    /** CUSTOMER_PAYS, SHOP_PAYS, or EVEN. */
    private String netCashDirection;
    /** Can be negative (SHOP_PAYS) - never clamped, unlike `total` in the no-trade-in case. */
    private BigDecimal netCashAmount;
    /** V36: over-valued trade-in excess granted to the member's store credit balance instead of a
     * SHOP_PAYS cash payout - 0 for every sale that isn't this specific case. */
    private BigDecimal tradeInStoreCreditGranted;

    // --- Void/refund (V34) --------------------------------------------------------------
    /** COMPLETED or VOIDED. */
    private String status;
    private LocalDateTime voidedAt;
    private String voidedBy;
    private String voidReason;
}
