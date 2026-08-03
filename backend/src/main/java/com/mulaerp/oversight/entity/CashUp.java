package com.mulaerp.oversight.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One payment-method row of a daily cash-up / Z-report: {@code expected} is always recomputed
 * server-side from operational tables (PoS sales, repair payments, trade-in cash payouts) at both
 * GET and POST time - see {@link com.mulaerp.oversight.service.CashUpService} - never trusted from
 * the client. {@code counted} is the staff-entered physical count; {@code variance = counted -
 * expected}. One row per (date, paymentMethod) - see the {@code uq_cash_ups_date_method}
 * constraint in V30.
 */
@Entity
@Table(name = "cash_ups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CashUp extends BaseEntity {

    @Column(name = "cash_up_date", nullable = false)
    private LocalDate cashUpDate;

    /** CASH, CARD, EWALLET, or STORE_CREDIT - same set PosSale/RepairPayment already validate against. */
    @Column(name = "payment_method", nullable = false, length = 20)
    private String paymentMethod;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal expected = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal counted = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal variance = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String notes;

    /** The authenticated user who saved this count - stamped server-side, never client-supplied. */
    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
}
