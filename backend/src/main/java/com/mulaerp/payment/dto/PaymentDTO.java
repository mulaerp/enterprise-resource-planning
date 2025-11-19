package com.mulaerp.payment.dto;

import com.mulaerp.payment.entity.Payment;
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
public class PaymentDTO {
    private UUID id;
    private String paymentNumber;
    private UUID invoiceId;
    private String invoiceNumber;
    private LocalDate paymentDate;
    private BigDecimal amount;
    private Payment.PaymentMethod method;
    private String reference;
    private Payment.PaymentStatus status;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
