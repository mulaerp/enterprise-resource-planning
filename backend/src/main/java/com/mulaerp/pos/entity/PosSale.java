package com.mulaerp.pos.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A completed thrift-store PoS sale. {@code clientSaleId} is the offline-sync idempotency key:
 * the client (register app) generates it once per sale attempt and retries the same POST until
 * it gets a response, so PosSaleService#createSale must return the existing sale unchanged
 * (HTTP 200) rather than create a duplicate when a clientSaleId is replayed.
 */
@Entity
@Table(name = "pos_sales")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PosSale extends BaseEntity {

    /** Server-generated, e.g. "POS-2026-000001". */
    @Column(name = "sale_number", nullable = false, unique = true, length = 30)
    private String saleNumber;

    /** Client-generated idempotency key - see class Javadoc. */
    @Column(name = "client_sale_id", nullable = false, unique = true, length = 100)
    private String clientSaleId;

    @Column(name = "member_id")
    private UUID memberId;

    /** The voucher code actually applied (normalized uppercase), or null if none was used. */
    @Column(name = "voucher_code", length = 50)
    private String voucherCode;

    /** CASH, CARD, or EWALLET. */
    @Column(name = "payment_method", nullable = false, length = 20)
    private String paymentMethod;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountTotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal total;

    @Column(name = "amount_tendered", precision = 15, scale = 2)
    private BigDecimal amountTendered;

    @Column(precision = 15, scale = 2)
    private BigDecimal change;

    @Column(name = "points_earned", nullable = false)
    private Integer pointsEarned = 0;

    // --- Part-exchange (WP) --------------------------------------------------------------
    /** The PosTradeIn created for this sale's part-exchange, if any (payoutType APPLIED_TO_SALE). */
    @Column(name = "trade_in_id")
    private UUID tradeInId;

    /** Sum of the embedded trade-in lines' payoutAmount (credit rate) - 0 when no trade-in. */
    @Column(name = "trade_in_value_applied", nullable = false, precision = 15, scale = 2)
    private BigDecimal tradeInValueApplied = BigDecimal.ZERO;

    /** Store credit actually redeemed against this sale - 0 when none redeemed. */
    @Column(name = "store_credit_redeemed", nullable = false, precision = 15, scale = 2)
    private BigDecimal storeCreditRedeemed = BigDecimal.ZERO;

    /** The amount owed after all discounts/store-credit/trade-in netting - CAN be negative (the
     * shop owes the customer cash) when tradeInValueApplied exceeds what's left to pay; the
     * historical clampToZero-to-non-negative behaviour is preserved when there is no trade-in
     * (tradeInValueApplied == 0), since this then equals the old `total` semantics exactly. */
    @Column(name = "net_cash_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal netCashAmount = BigDecimal.ZERO;

    /** CUSTOMER_PAYS, SHOP_PAYS, or EVEN - see PosSaleService#determineNetCashDirection. */
    @Column(name = "net_cash_direction", nullable = false, length = 20)
    private String netCashDirection = "CUSTOMER_PAYS";

    /** V36: the portion of an embedded (part-exchange) trade-in's value, valued at the
     * STORE_CREDIT rate, that exceeded what this sale needed and was granted to the member's
     * store credit balance instead of paid out as cash (SHOP_PAYS) - see
     * PosSaleService#createSale/#voidSale. Zero for every sale that isn't this specific case. */
    @Column(name = "trade_in_store_credit_granted", nullable = false, precision = 15, scale = 2)
    private BigDecimal tradeInStoreCreditGranted = BigDecimal.ZERO;

    // --- Void/refund (V34) ----------------------------------------------------------------
    /** COMPLETED or VOIDED - see PosSaleService#voidSale. The original sale row is never
     * edited/deleted on void; only this status (plus voidedAt/voidedBy/voidReason) changes. */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "COMPLETED";

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    /** Username of the MANAGER/ADMIN who voided the sale (RoleRules.MANAGER_UP backs the void
     * endpoint - a cashier can never void their own sale). */
    @Column(name = "voided_by")
    private String voidedBy;

    @Column(name = "void_reason", columnDefinition = "TEXT")
    private String voidReason;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PosSaleLine> lines = new ArrayList<>();

    public void addLine(PosSaleLine line) {
        lines.add(line);
        line.setSale(this);
    }
}
