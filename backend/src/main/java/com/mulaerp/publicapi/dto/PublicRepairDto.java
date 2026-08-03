package com.mulaerp.publicapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * PUBLIC-API: anonymous repair status lookup response - mirrors PublicWarrantyDto's always-200
 * {found:...} contract. Deliberately exposes NO customer PII (no customer name/phone, no device
 * description, no reported fault) - only what a customer needs to check on their own job.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublicRepairDto {
    private boolean found;
    private String jobNumber;
    private String status;
    private LocalDate promisedDate;
    private BigDecimal quoteAmount;
    private boolean awaitingApproval;

    public static PublicRepairDto notFound() {
        return new PublicRepairDto(false, null, null, null, null, false);
    }
}
