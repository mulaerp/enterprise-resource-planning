package com.mulaerp.voucher.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoucherDto {
    private UUID id;
    private String code;
    private String type;
    private BigDecimal value;
    private BigDecimal minSpend;
    private LocalDate expiresAt;
    private Integer usageLimit;
    private Integer usedCount;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
