package com.mulaerp.banking.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaymentSuggestionDTO {
    private UUID paymentId;
    private String paymentNumber;
    private LocalDate paymentDate;
    private BigDecimal amount;
    private long daysDifference;
}
