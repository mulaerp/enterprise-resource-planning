package com.mulaerp.oversight.repository;

import com.mulaerp.repair.entity.RepairPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * OVERSIGHT: read-only secondary repository over {@link RepairPayment} - see
 * OversightPosSaleRepository javadoc. {@code RepairPaymentRepository} (repair module) only exposes
 * a per-job lookup; money-flow/cash-up need a date-range scan across every job, which is what this
 * adds without touching the repair module's own repository.
 */
@Repository
public interface OversightRepairPaymentRepository extends JpaRepository<RepairPayment, UUID> {

    List<RepairPayment> findByPaidAtBetween(LocalDateTime from, LocalDateTime to);

    /** MY-DAY: repair payments this cashier personally collected (COLLECTION rows only, isRefund
     * false) on a given day - see MyDayService javadoc. */
    List<RepairPayment> findByPaidAtBetweenAndCreatedByAndIsRefundFalse(LocalDateTime from, LocalDateTime to, String createdBy);

    /** MY-DAY: repair payment REFUNDS this cashier personally actioned on a given day (V37:
     * refundedBy - distinct from createdBy, see RepairPayment javadoc) - feeds the "cash refunds"
     * leg of expectedCashInDrawer. */
    List<RepairPayment> findByPaidAtBetweenAndRefundedByAndIsRefundTrue(LocalDateTime from, LocalDateTime to, String refundedBy);
}
