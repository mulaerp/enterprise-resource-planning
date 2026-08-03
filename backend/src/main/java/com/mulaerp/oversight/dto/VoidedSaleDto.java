package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** V34: one row of the oversight exceptions "Voided sales" section - who voided a sale and why,
 * alongside the document reference so the UI can drill down to the sale detail page. */
public record VoidedSaleDto(
        UUID id,
        String saleNumber,
        LocalDateTime voidedAt,
        String voidedBy,
        String voidReason,
        BigDecimal total
) {
}
