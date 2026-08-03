package com.mulaerp.banking.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class MatchPaymentRequest {
    @NotNull(message = "paymentId is required")
    private UUID paymentId;

    /** When true, skip the amount-equality check and match anyway. */
    private boolean force = false;
}
