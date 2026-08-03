package com.mulaerp.warranty.dto;

import com.mulaerp.warranty.entity.Warranty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WarrantyDto {
    private UUID id;
    private String warrantyNumber;
    private UUID productId;
    private String productName;
    private UUID serialId;
    private UUID batchId;
    private UUID posSaleId;
    private UUID salesOrderId;
    private UUID repairJobId;
    private UUID shopOrderId;
    private UUID shopCustomerId;
    private UUID customerId;
    private UUID memberId;
    private LocalDate startDate;
    private Integer months;
    /** V44: set only when {@link #durationSource} is GUEST_BASE/MEMBER_BASE - see the Warranty entity. */
    private Integer durationDays;
    /** V44: which rule produced {@link #expiryDate} - see Warranty.DurationSource's javadoc. */
    private Warranty.DurationSource durationSource;
    private LocalDate expiryDate;
    private Warranty.WarrantyStatus status;
    private String terms;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    /** V44: human-readable coverage summary, e.g. "10 days (member)" / "6 month(s) (product)" -
     * computed once here so every frontend surface (staff detail page, customer-facing lookup)
     * renders the same explanation without duplicating the day-vs-month branching logic. */
    private String coverageLabel;

    public static WarrantyDto fromEntity(Warranty w) {
        WarrantyDto dto = new WarrantyDto();
        dto.setId(w.getId());
        dto.setWarrantyNumber(w.getWarrantyNumber());
        dto.setProductId(w.getProductId());
        dto.setProductName(w.getProductName());
        dto.setSerialId(w.getSerialId());
        dto.setBatchId(w.getBatchId());
        dto.setPosSaleId(w.getPosSaleId());
        dto.setSalesOrderId(w.getSalesOrderId());
        dto.setRepairJobId(w.getRepairJobId());
        dto.setShopOrderId(w.getShopOrderId());
        dto.setShopCustomerId(w.getShopCustomerId());
        dto.setCustomerId(w.getCustomerId());
        dto.setMemberId(w.getMemberId());
        dto.setStartDate(w.getStartDate());
        dto.setMonths(w.getMonths());
        dto.setDurationDays(w.getDurationDays());
        dto.setDurationSource(w.getDurationSource());
        dto.setExpiryDate(w.getExpiryDate());
        dto.setStatus(w.getStatus());
        dto.setTerms(w.getTerms());
        dto.setCreatedAt(w.getCreatedAt());
        dto.setUpdatedAt(w.getUpdatedAt());
        dto.setCoverageLabel(coverageLabel(w));
        return dto;
    }

    /** Shared with {@code PublicWarrantyService} (the anonymous customer-facing lookup) so both
     * surfaces render the identical "10 days (member)" / "6 month(s) (product)" explanation
     * without duplicating the day-vs-month branching logic. */
    public static String coverageLabel(Warranty w) {
        return switch (w.getDurationSource()) {
            case GUEST_BASE -> w.getDurationDays() + " day" + (w.getDurationDays() == 1 ? "" : "s") + " (guest)";
            case MEMBER_BASE -> w.getDurationDays() + " day" + (w.getDurationDays() == 1 ? "" : "s") + " (member)";
            case PRODUCT_MONTHS -> w.getMonths() + " month" + (w.getMonths() == 1 ? "" : "s") + " (product)";
        };
    }
}
