package com.mulaerp.banking.repository;

import com.mulaerp.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * ACC-BANK: read-only lookup against the existing `payments` table, scoped to the banking
 * package (the payment module's own repository/service are out of scope for this feature).
 * Backs the reconciliation "suggestions" endpoint - candidate payments for a bank transaction are
 * any payment with the exact same amount, dated within a few days of the statement line.
 */
@Repository
public interface BankPaymentLookupRepository extends JpaRepository<Payment, UUID> {

    @Query("SELECT p FROM Payment p WHERE p.amount = :amount " +
            "AND p.paymentDate BETWEEN :startDate AND :endDate")
    List<Payment> findByAmountAndPaymentDateBetween(
            @Param("amount") BigDecimal amount,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
