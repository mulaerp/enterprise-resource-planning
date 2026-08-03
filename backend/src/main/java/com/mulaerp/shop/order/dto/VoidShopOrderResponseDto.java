package com.mulaerp.shop.order.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * {@code POST /api/v1/shop/admin/orders/{id}/void} response - the updated (VOIDED) order plus
 * exactly what was reversed, mirroring {@code VoidPosSaleResponseDto}'s shape so staff read the
 * same information in the same place for either sale channel.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoidShopOrderResponseDto {
    private ShopOrderDto order;
    /** Always "CASH" today - PAY_AT_COLLECTION always resolved to Cash on Hand at fulfilment (see
     * ShopOrderService#fulfilOrder's javadoc); GATEWAY is unreachable while
     * payment.gateway.enabled=false. */
    private String refundMethod;
    /** The positive cash-equivalent amount to hand back via refundMethod - order.total minus
     * whatever store credit was redeemed against it (that portion is reversed automatically, see
     * storeCreditReversed, never handed over physically). */
    private BigDecimal refundAmount;
    private List<StockReturnedItem> stockReturned;
    /** Store credit credited back to the member because they had redeemed it against this order at
     * fulfilment - 0 when none was redeemed or there is no linked member. */
    private BigDecimal storeCreditReversed;
    /** Points deducted from the member that were earned on this order - 0 when none or no member. */
    private Integer pointsDeducted;
    /** Warranty numbers (Gap B's output) VOIDed as part of this order's reversal - see
     * WarrantyService#voidWarranty, called once per warranty linked via shopOrderId. */
    private List<String> warrantiesVoided;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockReturnedItem {
        private UUID productId;
        private String sku;
        private String productName;
        private int quantity;
    }
}
