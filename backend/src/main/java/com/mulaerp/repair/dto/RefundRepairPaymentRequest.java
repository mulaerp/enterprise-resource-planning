package com.mulaerp.repair.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * POST /repairs/{id}/payments/{paymentId}/refund (V37).
 *
 * <p>{@code method} is optional - defaults to the original payment's own method when omitted (the
 * refund goes back the way it came in), or may be set to any of CASH/CARD/EWALLET/STORE_CREDIT
 * explicitly - see RepairJobService#refundPayment.
 *
 * <p>{@code override} defaults to false. A refund that would leave a COLLECTED job underpaid
 * relative to totalCost is rejected (409) unless the caller explicitly sets this to true - see
 * RepairJobService#refundPayment javadoc for the reasoning (a collected-but-now-underpaid job is a
 * data-integrity smell that should require a deliberate decision, e.g. an acknowledged goodwill
 * refund on a disputed repair).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RefundRepairPaymentRequest {

    @NotNull(message = "amount is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "amount must be positive")
    private BigDecimal amount;

    private String method;

    @NotBlank(message = "reason is required")
    private String reason;

    private boolean override = false;
}
