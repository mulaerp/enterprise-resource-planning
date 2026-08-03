package com.mulaerp.oversight.dto;

import java.util.List;
import java.util.UUID;

/** GET /api/v1/oversight/trace/item response - see {@link com.mulaerp.oversight.service.ItemTraceService}. */
public record ItemTraceResponseDto(
        UUID productId,
        String sku,
        String productName,
        List<ItemTraceEventDto> events,
        boolean truncated,
        String note
) {
}
