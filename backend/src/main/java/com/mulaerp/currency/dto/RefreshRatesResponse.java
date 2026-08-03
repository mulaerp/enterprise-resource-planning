package com.mulaerp.currency.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Response body for {@code POST /api/v1/currencies/refresh-rates} on success. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RefreshRatesResponse {
    private int updated;
    private String provider;
    private LocalDateTime fetchedAt;
}
