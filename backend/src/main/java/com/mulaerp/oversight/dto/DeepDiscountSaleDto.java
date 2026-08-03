package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DeepDiscountSaleDto(
        String saleNumber,
        LocalDateTime createdAt,
        String cashier,
        BigDecimal subtotal,
        BigDecimal discountTotal,
        BigDecimal discountPercent
) {
}
