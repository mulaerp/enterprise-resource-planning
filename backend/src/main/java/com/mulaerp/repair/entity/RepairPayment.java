package com.mulaerp.repair.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * A payment recorded against a repair job - DEPOSIT (posts its own Dr Cash-or-StoreCredit / Cr
 * Customer Deposits entry immediately), or BALANCE/FULL (recognized only in the aggregate revenue
 * entry posted at the COLLECTED transition - see RepairJobService). Append-only, same rationale as
 * StockMovement/RepairPart.
 *
 * <p><b>Refunds (V37)</b>: a refund is its own row on this same table, never an edit of the
 * original payment row (the original stays immutable exactly as before). {@link #isRefund} marks
 * it; {@link #originalPaymentId} links it back to the specific payment it refunds; {@link #amount}
 * is always a positive quantity (the amount refunded), never a negative number - see
 * V37__repair_payment_refunds.sql for the full model-choice rationale (explicit columns over a
 * signed REFUND amount_type). {@link #amountType} on a refund row is copied from the original
 * payment purely as informational metadata about what kind of payment is being refunded; it is
 * never used to derive accounting treatment (see RepairJobService#refundPayment javadoc - that
 * derivation reads the job's status instead). Net paid for a job = SUM(amount) where
 * isRefund=false MINUS SUM(amount) where isRefund=true (collections minus refunds) - see
 * RepairJobService#computeNetPaid.
 */
@Entity
@Table(name = "repair_payments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class RepairPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "repair_job_id", nullable = false)
    private UUID repairJobId;

    @Enumerated(EnumType.STRING)
    @Column(name = "amount_type", nullable = false, length = 20)
    private AmountType amountType;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_method", nullable = false, length = 20)
    private String paymentMethod;

    @Column(name = "paid_at", nullable = false)
    private LocalDateTime paidAt = LocalDateTime.now();

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    /** V37: true for a refund row, false (the default) for a normal collection row. */
    @Column(name = "is_refund", nullable = false)
    private Boolean isRefund = false;

    /** V37: set only on a refund row - the id of the RepairPayment being refunded. */
    @Column(name = "original_payment_id")
    private UUID originalPaymentId;

    /** V37: required on a refund row (enforced by a DB CHECK constraint) - why the money went back. */
    @Column(name = "refund_reason", columnDefinition = "TEXT")
    private String refundReason;

    /** V37: required on a refund row - the username of the manager/admin who actioned the refund.
     * Distinct from {@link #createdBy} (which would hold the same value in practice, via Spring
     * Data auditing) so the refund's audit trail is self-descriptive without relying on that
     * generic convention. */
    @Column(name = "refunded_by")
    private String refundedBy;

    public enum AmountType {
        DEPOSIT,
        BALANCE,
        FULL
    }
}
