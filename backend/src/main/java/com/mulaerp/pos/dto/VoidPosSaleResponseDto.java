package com.mulaerp.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * {@code POST /pos/sales/{id}/void} response - the updated (VOIDED) sale plus exactly what was
 * reversed, so the cashier/manager knows what to hand over (a refund) or take back (a traded-in
 * item, or a store-credit clawback) at the counter.
 *
 * <p>{@code refundMethod}/{@code refundAmount} mirror the sale's own tender: store-credit
 * redemption, points, voucher usage, and (V36) an over-valued trade-in's store-credit grant are all
 * reversed automatically against the member's account (never require the cashier to hand anything
 * over), so they are NOT part of this pair - only the cash/card/e-wallet amount that must
 * physically be returned.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoidPosSaleResponseDto {
    private PosSaleDto sale;
    /** The sale's own paymentMethod (CASH/CARD/EWALLET/STORE_CREDIT) - what the refund should go back through. */
    private String refundMethod;
    /** The positive cash-equivalent amount to hand back via refundMethod - 0 when nothing is owed
     * (e.g. a SHOP_PAYS sale fully settled by a trade-in store-credit grant instead of cash, or a
     * sale fully covered by store credit). */
    private BigDecimal refundAmount;
    /** V36: every sold line returned to stock (SALE_VOID movements) - empty only if the sale
     * somehow had no lines. */
    private List<StockReturnedItem> stockReturned;
    /** V36: the traded-in item removed from stock again (TRADE_IN_VOID movement), or null when
     * this sale was not a part-exchange. */
    private TradeInItemRemoved tradeInItemRemoved;
    /** V36: store credit credited back to the member because they had redeemed it as payment on
     * this sale (sale.storeCreditRedeemed) - 0 when none was redeemed or there is no member. */
    private BigDecimal storeCreditReversed;
    /** V36: points deducted from the member that were earned on this sale - 0 when none or no member. */
    private Integer pointsDeducted;
    /** V36: store credit clawed back (debited) from the member because this part-exchange's
     * over-valued trade-in had granted it to them instead of the shop paying cash out - see
     * PosSaleService#createSale/#voidSale. 0 for every sale that isn't this specific case. */
    private BigDecimal tradeInStoreCreditDeducted;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockReturnedItem {
        private UUID productId;
        private String sku;
        private String productName;
        private int quantity;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradeInItemRemoved {
        private UUID productId;
        private String sku;
        private String productName;
        private int quantity;
        private String tradeInNumber;
    }
}
