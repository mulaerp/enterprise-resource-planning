package com.mulaerp.warranty.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

/** Manual warranty issue (staff), as opposed to the PoS/SO auto-issue hooks. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateWarrantyRequest {

    @NotNull(message = "productId is required")
    private UUID productId;

    private UUID serialId;

    private UUID batchId;

    private UUID posSaleId;

    private UUID salesOrderId;

    private UUID customerId;

    private UUID memberId;

    /** Defaults to today when omitted. */
    private LocalDate startDate;

    @NotNull(message = "months is required")
    @Min(value = 1, message = "months must be at least 1")
    private Integer months;

    private String terms;
}
