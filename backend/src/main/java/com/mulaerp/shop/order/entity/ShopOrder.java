package com.mulaerp.shop.order.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * An online storefront order (WEBSHOP task). Either {@link #shopCustomerId} is set (a signed-in
 * customer) or the three {@code guest*} fields are (a GUEST checkout) - never both, never
 * neither; enforced by {@code ShopOrderService}, not a DB constraint (mirrors how
 * {@code PosSale.memberId} is an optional, app-validated FK).
 *
 * <h2>Status lifecycle</h2>
 * <pre>
 * PENDING -&gt; RESERVED           (ShopOrderService#placeOrder - stock reserved, SHOP_RESERVE
 *                                  movement written; PENDING is never actually persisted today -
 *                                  see placeOrder's javadoc)
 * RESERVED -&gt; READY              (staff: item picked/packed - optional step)
 * RESERVED/READY -&gt; FULFILLED    (staff: handover/shipment - see #fulfilOrder for the full ledger
 *                                  model)
 * RESERVED/AWAITING_PAYMENT -&gt; CANCELLED   (customer or staff cancel - stock released)
 * RESERVED/AWAITING_PAYMENT -&gt; EXPIRED     (release job - stock released)
 * </pre>
 * {@code AWAITING_PAYMENT} and {@code PAID} exist for a future enabled-gateway flow (a webhook
 * confirming payment before collection) - see {@code com.mulaerp.shop.payment}. Neither is ever
 * reached while {@code payment.gateway.enabled=false} (the default): every order today goes
 * straight from placement to {@code RESERVED} with {@code paymentMethod = PAY_AT_COLLECTION}.
 */
@Entity
@Table(name = "shop_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ShopOrder extends BaseEntity {

    /** Server-generated, e.g. "WEB-2026-000001-a1b2" - see ShopOrderService#generateOrderNumber. */
    @Column(name = "order_number", nullable = false, unique = true, length = 40)
    private String orderNumber;

    /** Nullable - set for a signed-in customer's order, null for a GUEST checkout. */
    @Column(name = "shop_customer_id")
    private UUID shopCustomerId;

    @Column(name = "guest_email")
    private String guestEmail;

    @Column(name = "guest_name")
    private String guestName;

    @Column(name = "guest_phone")
    private String guestPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "fulfilment_type", nullable = false, length = 20)
    private FulfilmentType fulfilmentType;

    /** Required when {@link #fulfilmentType} is {@code POST}; null otherwise. */
    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "delivery_fee", nullable = false, precision = 15, scale = 2)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal total;

    @Column(name = "reserved_until")
    private LocalDateTime reservedUntil;

    /** V42 (WEBSHOP Gap C): stamped once, at {@code ShopOrderService#fulfilOrder} - the void
     * window (mulaerp.shop.void-window-days) is measured from this, not createdAt, since a
     * reservation can sit RESERVED for up to reservation-hours before ever being fulfilled. Null
     * until fulfilled. */
    @Column(name = "fulfilled_at")
    private LocalDateTime fulfilledAt;

    /** V42: snapshot of what {@code #fulfilOrder} actually redeemed, so {@code #voidOrder} can
     * restore exactly this amount - mirrors {@code PosSale.storeCreditRedeemed}. */
    @Column(name = "store_credit_redeemed", nullable = false, precision = 15, scale = 2)
    private BigDecimal storeCreditRedeemed = BigDecimal.ZERO;

    /** V42: snapshot of the points accrued at fulfilment, so {@code #voidOrder} can deduct exactly
     * this many back - mirrors {@code PosSale.pointsEarned}. */
    @Column(name = "points_earned", nullable = false)
    private Integer pointsEarned = 0;

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @Column(name = "voided_by")
    private String voidedBy;

    @Column(name = "void_reason", columnDefinition = "TEXT")
    private String voidReason;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ShopOrderLine> lines = new ArrayList<>();

    public void addLine(ShopOrderLine line) {
        lines.add(line);
        line.setOrder(this);
    }

    public enum FulfilmentType {
        COLLECT, POST
    }

    /** V42: VOIDED added (Gap C) - reachable only from FULFILLED, via
     * {@code ShopOrderService#voidOrder}. See that method's javadoc for the full reversal model. */
    public enum OrderStatus {
        PENDING, RESERVED, AWAITING_PAYMENT, PAID, READY, FULFILLED, CANCELLED, EXPIRED, VOIDED
    }

    public enum PaymentMethod {
        PAY_AT_COLLECTION, GATEWAY
    }
}
