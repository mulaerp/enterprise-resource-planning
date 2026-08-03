package com.mulaerp.member.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberDto {
    private UUID id;
    private String code;
    private String name;
    private String phone;
    private String email;
    private Integer points;
    private String tier;
    private BigDecimal discountPercent;
    private BigDecimal storeCreditBalance;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
