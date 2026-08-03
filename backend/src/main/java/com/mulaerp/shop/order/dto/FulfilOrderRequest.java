package com.mulaerp.shop.order.dto;

import lombok.Data;

import java.math.BigDecimal;

/** Body for POST /api/v1/shop/admin/orders/{id}/fulfil. Both fields optional and only meaningful
 * when the order belongs to a customer linked to a loyalty member (ShopCustomer.memberId != null)
 * - see ShopOrderService#fulfilOrder. */
@Data
public class FulfilOrderRequest {

    /** Store credit to redeem against this order's total, clamped to the member's balance -
     * ignored (and rejected with 400 if positive) for a guest or non-member-linked order. */
    private BigDecimal storeCreditRedeemed;
}
