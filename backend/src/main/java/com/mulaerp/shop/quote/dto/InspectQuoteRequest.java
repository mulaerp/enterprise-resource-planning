package com.mulaerp.shop.quote.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/** POST /api/v1/shop/admin/quotes/{id}/inspect - staff records the final offer after physically
 * inspecting the item. finalOffer may fall outside [quotedMin, quotedMax] (see
 * ShopTradeInQuoteService#inspect) - in that case notes must explain why. */
@Data
public class InspectQuoteRequest {

    @NotNull(message = "finalOffer is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "finalOffer must not be negative")
    private BigDecimal finalOffer;

    @NotBlank(message = "payoutType is required")
    private String payoutType;

    private String notes;
}
