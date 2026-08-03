package com.mulaerp.accounting.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PostBatchResultDTO {
    private int posted;
    private BigDecimal totalDebits;
    private BigDecimal totalCredits;
}
