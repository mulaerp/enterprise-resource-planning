package com.mulaerp.inventory.entity;

import com.mulaerp.product.entity.Product;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * WP7: append-only movement ledger recorded alongside every mutation of Product.stockQuantity /
 * warehouse_stock. Counters (Product.stockQuantity, warehouse_stock) stay authoritative - this is
 * an audit trail, not a source of truth, so it is never updated or soft-deleted once written (no
 * updatedAt/updatedBy/deleted fields, unlike BaseEntity). Reuses the pre-existing (previously
 * unused) `stock_movements` table from V2, extended in V22 - see that migration for the
 * reuse-vs-supersede rationale.
 *
 * Only recorded via {@link com.mulaerp.inventory.service.StockMovementService#recordMovement},
 * called in the same transaction as the underlying stock mutation so a rollback removes both.
 */
@Entity
@Table(name = "stock_movements")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** Plain id, not an entity relation - mirrors StockAdjustment/StockTransfer's warehouseId
     * pattern. Nullable: PO_RECEIPT movements aren't attributed to a warehouse today (see V22). */
    @Column(name = "warehouse_id")
    private UUID warehouseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 50)
    private MovementType movementType;

    /** Signed change in stock caused by this movement (positive = in, negative = out). */
    @Column(name = "quantity_delta", nullable = false)
    private Integer quantityDelta;

    /** Product.stockQuantity total immediately after this movement. */
    @Column(name = "quantity_after")
    private Integer quantityAfter;

    /** Document number this movement is attributable to (adjustment/transfer/sale/PO/SO number). */
    @Column(length = 255)
    private String reference;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    public enum MovementType {
        ADJUSTMENT,
        TRANSFER_OUT,
        TRANSFER_IN,
        POS_SALE,
        SO_DELIVERY,
        PO_RECEIPT,
        RECOUNT,
        /** WP: a traded-in item received into inventory from a customer (PosTradeInService). */
        TRADE_IN_RECEIPT,
        /** WP: stock consumed by a repair job at its IN_REPAIR transition (RepairJobService);
         * reused with a positive delta to reverse consumption if the job is cancelled from
         * IN_REPAIR. */
        REPAIR_PART_CONSUMED,
        /** V34: stock returned to inventory when a PoS sale is voided (PosSaleService#voidSale).
         * Always a positive delta - the original POS_SALE movement is never edited/deleted, this
         * is an independent, additional ledger row. */
        SALE_VOID,
        /** V36: a traded-in item's stock removed again when the PoS sale that part-exchanged it is
         * voided (PosSaleService#voidSale). Always a negative delta - the original TRADE_IN_RECEIPT
         * movement is never edited/deleted, this is an independent, additional ledger row (mirrors
         * SALE_VOID, just in the opposite direction and against the traded-in product rather than
         * the sold one). */
        TRADE_IN_VOID,
        /** V40 (WEBSHOP): stock reserved the instant an online order is placed
         * (ShopOrderService#placeOrder) - always a negative delta, reference = the order number.
         * See ShopOrderService's class javadoc for the full reservation-vs-fulfilment ledger
         * model: a FULFILLED order writes no further movement (this row already is the ledger's
         * record of the unit leaving stock); only a cancelled/expired reservation writes the
         * matching SHOP_RELEASE below. */
        SHOP_RESERVE,
        /** V40 (WEBSHOP): stock returned when a reservation is cancelled (immediately) or expires
         * unpaid/uncollected (ShopOrderService#releaseExpiredReservations /
         * ShopOrderReservationScheduler) - always a positive delta, reference = the order number. */
        SHOP_RELEASE,
        /** V42 (WEBSHOP Gap C): stock returned when a FULFILLED web order is voided
         * (ShopOrderService#voidOrder) - always a positive delta, reference = the order number.
         * Deliberately distinct from SHOP_RELEASE: that type means a reservation was released
         * WITHOUT ever becoming a sale (no revenue/COGS was posted); this type means a sale WAS
         * posted and is now being reversed - mirrors SALE_VOID's role on the PoS side. See V42's
         * migration javadoc for the full movement-type decision. */
        SHOP_VOID
    }
}
