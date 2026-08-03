package com.mulaerp.repair.dto;

import com.mulaerp.repair.entity.RepairJob;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepairJobDto {
    private UUID id;
    private String jobNumber;
    private UUID customerId;
    private String walkInName;
    private String walkInPhone;
    private UUID productId;
    private String serialNumber;
    private String deviceDescription;
    private String reportedFault;
    private String diagnosis;
    private RepairJob.RepairStatus status;
    private BigDecimal quoteAmount;
    private BigDecimal partsCost;
    private BigDecimal labourCost;
    private BigDecimal totalCost;
    private UUID warrantyId;
    private Boolean isWarrantyClaim;
    private String notes;
    private LocalDateTime receivedAt;
    private LocalDateTime completedAt;
    private LocalDateTime collectedAt;
    private LocalDate promisedDate;
    private LocalDateTime approvedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long version;

    /** Populated by RepairJobService - not derivable from the entity alone. */
    private List<RepairPartDto> parts;
    private List<RepairPaymentDto> payments;

    /** Gross collections only (sum of non-refund payment rows) - kept for backward compatibility
     * with existing callers of this field; does NOT subtract refunds. Use {@link #netPaid} for
     * "how much has this customer actually paid, net of any refunds". */
    private BigDecimal totalPaid;

    /** V37: sum of refund rows (isRefund=true) for this job. */
    private BigDecimal totalRefunded;

    /** V37: totalPaid minus totalRefunded - "collections minus refunds", trivially computable per
     * the V37 migration's model choice. This is the figure the COLLECTED-transition and refund
     * guards compare against totalCost. */
    private BigDecimal netPaid;

    private UUID issuedWarrantyId;

    public static RepairJobDto fromEntity(RepairJob job) {
        RepairJobDto dto = new RepairJobDto();
        dto.setId(job.getId());
        dto.setJobNumber(job.getJobNumber());
        dto.setCustomerId(job.getCustomerId());
        dto.setWalkInName(job.getWalkInName());
        dto.setWalkInPhone(job.getWalkInPhone());
        dto.setProductId(job.getProductId());
        dto.setSerialNumber(job.getSerialNumber());
        dto.setDeviceDescription(job.getDeviceDescription());
        dto.setReportedFault(job.getReportedFault());
        dto.setDiagnosis(job.getDiagnosis());
        dto.setStatus(job.getStatus());
        dto.setQuoteAmount(job.getQuoteAmount());
        dto.setPartsCost(job.getPartsCost());
        dto.setLabourCost(job.getLabourCost());
        dto.setTotalCost(job.getTotalCost());
        dto.setWarrantyId(job.getWarrantyId());
        dto.setIsWarrantyClaim(job.getIsWarrantyClaim());
        dto.setNotes(job.getNotes());
        dto.setReceivedAt(job.getReceivedAt());
        dto.setCompletedAt(job.getCompletedAt());
        dto.setCollectedAt(job.getCollectedAt());
        dto.setPromisedDate(job.getPromisedDate());
        dto.setApprovedAt(job.getApprovedAt());
        dto.setCreatedAt(job.getCreatedAt());
        dto.setUpdatedAt(job.getUpdatedAt());
        dto.setVersion(job.getVersion());
        return dto;
    }
}
