package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PriceFloorSaleLineDto(
        String saleNumber,
        LocalDateTime createdAt,
        String cashier,
        String productSku,
        String productName,
        BigDecimal unitPrice,
        BigDecimal priceFloor,
        BigDecimal marginAbovefloorPercent
) {
}
