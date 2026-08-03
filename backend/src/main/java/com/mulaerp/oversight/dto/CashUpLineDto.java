package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CashUpLineDto(
        String paymentMethod,
        BigDecimal expected,
        BigDecimal counted,
        BigDecimal variance,
        String notes,
        String approvedBy,
        LocalDateTime approvedAt,
        boolean saved
) {
}
