package com.mulaerp.shop.order.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** {@code POST /api/v1/shop/admin/orders/{id}/void} request body - reason is mandatory, same
 * contract as {@code VoidPosSaleRequest} (surfaced verbatim on the order, mirroring how a PoS
 * void's reason is recorded). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoidShopOrderRequest {

    @NotBlank(message = "reason is required")
    private String reason;
}
