package com.mulaerp.currency.dto;

import com.mulaerp.currency.entity.Currency;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CurrencyDto {
    private UUID id;
    private String code;
    private String name;
    private String symbol;
    private BigDecimal rate;
    private String rateSource;
    private LocalDateTime rateFetchedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CurrencyDto fromEntity(Currency c) {
        CurrencyDto dto = new CurrencyDto();
        dto.setId(c.getId());
        dto.setCode(c.getCode());
        dto.setName(c.getName());
        dto.setSymbol(c.getSymbol());
        dto.setRate(c.getRate());
        dto.setRateSource(c.getRateSource());
        dto.setRateFetchedAt(c.getRateFetchedAt());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setUpdatedAt(c.getUpdatedAt());
        return dto;
    }
}
