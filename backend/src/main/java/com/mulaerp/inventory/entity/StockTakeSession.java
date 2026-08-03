package com.mulaerp.inventory.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A single guided physical-count pass over one warehouse (V32 migration). Carries no direct
 * @OneToMany to {@link StockTakeLine} on purpose - a session can snapshot thousands of lines, so
 * every line access goes through {@code StockTakeLineRepository}'s paginated queries instead of
 * loading the whole collection via the entity graph (see {@code StockTakeService}).
 *
 * <p>Lifecycle: OPEN (just opened, snapshot taken) -> COUNTING (at least one count recorded) ->
 * REVIEW (submitted) -> APPROVED (approved; this is the only transition that mutates stock,
 * exactly once - a second approve attempt 409s) - or CANCELLED from any pre-APPROVED state, which
 * never touches stock.
 */
@Entity
@Table(name = "stock_take_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class StockTakeSession extends BaseEntity {

    @Column(name = "session_number", nullable = false, unique = true, length = 100)
    private String sessionNumber;

    /** Plain id, not an entity relation - mirrors StockAdjustment/StockTransfer's warehouseId pattern. */
    @Column(name = "warehouse_id", nullable = false)
    private UUID warehouseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockTakeStatus status = StockTakeStatus.OPEN;

    @Column(name = "opened_at", nullable = false)
    private LocalDateTime openedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "approved_by", length = 255)
    private String approvedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public enum StockTakeStatus {
        OPEN,
        COUNTING,
        REVIEW,
        APPROVED,
        CANCELLED
    }
}
