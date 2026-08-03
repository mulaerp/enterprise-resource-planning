package com.mulaerp.publicapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * PUBLIC-API: no customer/member PII - see PublicWarrantyService#lookup, which never reads
 * Warranty#customerId/memberId onto this DTO.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublicWarrantyDto {
    private boolean found;
    private String status;
    private String productName;
    private LocalDate startDate;
    private LocalDate expiryDate;
    private Long remainingDays;
    /** V44: human-readable coverage summary, e.g. "10 days (member)" / "6 month(s) (product)" -
     * so the buyer can see WHY their cover is what it is, without exposing the internal
     * duration_source enum/customer identity. See WarrantyDto#coverageLabel (same computation). */
    private String coverageLabel;

    public static PublicWarrantyDto notFound() {
        return new PublicWarrantyDto(false, null, null, null, null, null, null);
    }
}
