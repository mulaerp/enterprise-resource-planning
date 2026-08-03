package com.mulaerp.currency.dto;

import com.mulaerp.currency.entity.FxRateFetchLog;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FxRateFetchLogDto {
    private UUID id;
    private LocalDateTime fetchedAt;
    private String provider;
    private String status;
    private String message;
    private Integer ratesUpdated;

    public static FxRateFetchLogDto fromEntity(FxRateFetchLog e) {
        return new FxRateFetchLogDto(
                e.getId(),
                e.getFetchedAt(),
                e.getProvider(),
                e.getStatus(),
                e.getMessage(),
                e.getRatesUpdated()
        );
    }
}
