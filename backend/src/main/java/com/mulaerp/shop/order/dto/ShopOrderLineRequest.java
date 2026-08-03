package com.mulaerp.shop.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/** One requested line - price/name/sku are always server-computed from the product record at
 * placement time, never trusted from the client (prevents a tampered-price checkout). */
@Data
public class ShopOrderLineRequest {

    @NotNull(message = "productId is required")
    private UUID productId;

    @NotNull(message = "quantity is required")
    @Min(value = 1, message = "quantity must be at least 1")
    private Integer quantity;
}
