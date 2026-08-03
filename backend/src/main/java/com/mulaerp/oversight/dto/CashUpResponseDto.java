package com.mulaerp.oversight.dto;

import java.time.LocalDate;
import java.util.List;

/** GET/POST /api/v1/oversight/cashup response - see {@link com.mulaerp.oversight.service.CashUpService}. */
public record CashUpResponseDto(
        LocalDate date,
        List<CashUpLineDto> lines
) {
}
