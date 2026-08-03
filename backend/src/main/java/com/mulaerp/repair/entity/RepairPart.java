package com.mulaerp.repair.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A stock item earmarked for (and, once the job reaches IN_REPAIR, actually consumed by) a repair
 * job. unitCost is a snapshot of the product's cost basis (costPrice, or acquisitionCost - same
 * priority as PosSaleService's own price-floor logic) taken when the part is added, mirroring
 * PosSaleLine#acquisitionCostSnapshot: it stays meaningful even if the product is edited later,
 * and is what both partsCost (customer-facing) and the COGS journal at IN_REPAIR are computed
 * from - see RepairJobService.
 *
 * <p>Append-only-ish (no update path, only add/delete before consumption) - modelled like
 * StockMovement rather than BaseEntity: no soft delete/version, a genuine DELETE removes the row
 * (only ever allowed before the job reaches IN_REPAIR, at which point stock has already moved).
 */
@Entity
@Table(name = "repair_parts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class RepairPart {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "repair_job_id", nullable = false)
    private UUID repairJobId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_cost", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitCost;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;
}
