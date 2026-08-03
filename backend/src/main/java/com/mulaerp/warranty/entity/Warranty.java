package com.mulaerp.warranty.entity;

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

import java.time.LocalDate;
import java.util.UUID;

/**
 * An in-house warranty on a specific product unit, auto-issued from a PoS sale line or a
 * delivered sales-order serial (see WarrantyService#autoIssueForPosSaleLine /
 * #autoIssueForSalesOrderSerial), or issued manually by staff. productId/productName are
 * point-in-time snapshots (mirrors PosSaleLine), so the warranty record stays meaningful even if
 * the product is later edited or soft-deleted.
 */
@Entity
@Table(name = "warranties")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Warranty extends BaseEntity {

    /** Server-generated, e.g. "WTY-2026-000001-a1b2". */
    @Column(name = "warranty_number", nullable = false, unique = true, length = 50)
    private String warrantyNumber;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    /** The specific ProductSerial this warranty covers, if the product is serial-tracked. */
    @Column(name = "serial_id")
    private UUID serialId;

    @Column(name = "batch_id")
    private UUID batchId;

    /** Origin sale/order - at most one of posSaleId/salesOrderId is set (mutually exclusive by construction). */
    @Column(name = "pos_sale_id")
    private UUID posSaleId;

    @Column(name = "sales_order_id")
    private UUID salesOrderId;

    /** WP: the repair job that produced this warranty (a workmanship warranty auto-issued at
     * COLLECTED) - the reverse of RepairJob#warrantyId, which instead points to the warranty that
     * was CLAIMED to spawn a repair job in the first place. Null for every other warranty origin. */
    @Column(name = "repair_job_id")
    private UUID repairJobId;

    /** V42 (WEBSHOP Gap B): the online order that earned this warranty, when auto-issued from
     * {@code ShopOrderService#fulfilOrder} - see {@code WarrantyService#autoIssueForShopOrderLine}.
     * This is also how a GUEST's warranty is found later: the guest has no shop_customers row, but
     * their order (guestEmail/guestName/guestPhone) is looked up by order number + email exactly
     * as {@code ShopOrderService#guestLookup} already does, and the warranty numbers linked via
     * this column are surfaced directly on that response. Null for every non-webshop origin. */
    @Column(name = "shop_order_id")
    private UUID shopOrderId;

    /** V42 (WEBSHOP Gap B): attribution for a SIGNED-IN shop customer's warranty when that
     * customer is NOT linked to a loyalty {@code Member} (the linked case sets {@link #memberId}
     * instead, mirroring exactly how {@code PosSaleService#issueLineWarranties} only ever sets
     * memberId, never customerId, for a member sale). Null for a guest order (shopOrderId alone
     * carries the guest's contact details) and null when memberId is set instead. */
    @Column(name = "shop_customer_id")
    private UUID shopCustomerId;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "member_id")
    private UUID memberId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** V44: nullable now that a channel-base warranty is measured in DAYS, not months - see
     * {@link #durationDays}/{@link #durationSource}. Set (and {@link #durationDays} left null)
     * whenever {@link #durationSource} is {@code PRODUCT_MONTHS}. */
    @Column
    private Integer months;

    /** V44: set (and {@link #months} left null) whenever {@link #durationSource} is
     * {@code GUEST_BASE}/{@code MEMBER_BASE} - the channel base-days figure actually applied. */
    @Column(name = "duration_days")
    private Integer durationDays;

    /** V44: WHICH rule produced {@link #expiryDate} - see WarrantyService#resolveDuration.
     * {@code expiryDate} stays the single authoritative field for every warranty computation
     * (claims, void, display); this exists purely so a claim dispute months later can be
     * explained. Defaults to {@code PRODUCT_MONTHS} (an explicit months figure) for every issuance
     * path that predates the guest/member channel-base floor (manual staff issue, sales-order
     * serial delivery, workmanship warranty) - only PoS/shop auto-issue ever set GUEST_BASE/
     * MEMBER_BASE, via the shared floor helper. */
    @Enumerated(EnumType.STRING)
    @Column(name = "duration_source", nullable = false, length = 20)
    private DurationSource durationSource = DurationSource.PRODUCT_MONTHS;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WarrantyStatus status = WarrantyStatus.ACTIVE;

    @Column(columnDefinition = "TEXT")
    private String terms;

    public enum WarrantyStatus {
        ACTIVE,
        EXPIRED,
        CLAIMED,
        VOID
    }

    /** V44: see {@link #durationSource}'s javadoc. */
    public enum DurationSource {
        PRODUCT_MONTHS,
        GUEST_BASE,
        MEMBER_BASE
    }
}
