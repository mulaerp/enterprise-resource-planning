package com.mulaerp.repair.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A repair-shop job ticket, either a paid walk-in repair or a warranty claim (isWarrantyClaim,
 * no charge - see RepairJobService#createForWarrantyClaim). customerId is set for a registered
 * customer; walkInName/walkInPhone cover a non-registered customer instead - the two are
 * mutually exclusive by construction (see RepairJobService).
 */
@Entity
@Table(name = "repair_jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RepairJob extends BaseEntity {

    /** Server-generated, e.g. "RJ-2026-000001-a1b2". */
    @Column(name = "job_number", nullable = false, unique = true, length = 50)
    private String jobNumber;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "walk_in_name")
    private String walkInName;

    @Column(name = "walk_in_phone", length = 30)
    private String walkInPhone;

    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "serial_number", length = 100)
    private String serialNumber;

    @Column(name = "device_description", nullable = false, columnDefinition = "TEXT")
    private String deviceDescription;

    @Column(name = "reported_fault", nullable = false, columnDefinition = "TEXT")
    private String reportedFault;

    @Column(columnDefinition = "TEXT")
    private String diagnosis;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RepairStatus status = RepairStatus.RECEIVED;

    @Column(name = "quote_amount", precision = 15, scale = 2)
    private BigDecimal quoteAmount;

    @Column(name = "parts_cost", precision = 15, scale = 2)
    private BigDecimal partsCost;

    @Column(name = "labour_cost", precision = 15, scale = 2)
    private BigDecimal labourCost;

    /** parts + labour, forced to 0 for a warranty claim - recomputed in RepairJobService#recomputeTotalCost. */
    @Column(name = "total_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalCost = BigDecimal.ZERO;

    /** Set when this job originated from Warranty#claim; null for a walk-in paid repair. */
    @Column(name = "warranty_id")
    private UUID warrantyId;

    @Column(name = "is_warranty_claim", nullable = false)
    private Boolean isWarrantyClaim = false;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt = LocalDateTime.now();

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "collected_at")
    private LocalDateTime collectedAt;

    /** WP: staff-set expected pick-up date, editable via PUT /repairs/{id}. */
    @Column(name = "promised_date")
    private LocalDate promisedDate;

    /** WP: stamped automatically on the APPROVED transition - see RepairJobService#updateStatus. */
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    public enum RepairStatus {
        RECEIVED,
        DIAGNOSED,
        AWAITING_APPROVAL,
        APPROVED,
        IN_REPAIR,
        COMPLETED,
        COLLECTED,
        CANCELLED
    }
}
