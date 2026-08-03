package com.mulaerp.shop.order.dto;

import com.mulaerp.shop.order.entity.ShopOrder;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * Shared request shape for both the signed-in-customer endpoint
 * (POST /api/v1/shop/orders) and the guest endpoint (POST /api/v1/public/shop/orders) -
 * {@code guestEmail}/{@code guestName}/{@code guestPhone} are required by
 * {@code ShopOrderService#placeOrder} only when called with no authenticated customer (see that
 * method's javadoc); the signed-in endpoint ignores them (identity comes from the session).
 */
@Data
public class PlaceShopOrderRequest {

    @NotEmpty(message = "At least one item is required")
    @Valid
    private List<ShopOrderLineRequest> items;

    @NotNull(message = "fulfilmentType is required")
    private ShopOrder.FulfilmentType fulfilmentType;

    /** Required (400 otherwise) when fulfilmentType = POST. */
    private String deliveryAddress;

    private String notes;

    // --- Guest-only fields - see class javadoc ---------------------------------------------
    private String guestEmail;
    private String guestName;
    private String guestPhone;
}
