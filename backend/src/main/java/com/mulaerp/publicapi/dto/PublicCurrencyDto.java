package com.mulaerp.publicapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * PUBLIC-API: anonymous currency list for the storefront's currency switcher. Only ever exposes
 * code/symbol/name/rate - no id, no audit columns.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublicCurrencyDto {
    private String code;
    private String symbol;
    private String name;
    private BigDecimal rate;
}
