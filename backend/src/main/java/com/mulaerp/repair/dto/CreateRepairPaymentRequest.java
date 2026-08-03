package com.mulaerp.repair.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** POST /repairs/{id}/payments. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateRepairPaymentRequest {

    @NotBlank(message = "amountType is required")
    private String amountType;

    @NotNull(message = "amount is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "amount must be positive")
    private BigDecimal amount;

    @NotBlank(message = "paymentMethod is required")
    private String paymentMethod;
}
