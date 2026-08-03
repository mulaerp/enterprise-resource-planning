package com.mulaerp.banking.repository;

import com.mulaerp.banking.entity.BankTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * ACC-BANK: JpaSpecificationExecutor backs the multi-filter GET /api/v1/bank/transactions
 * (reconciled / startDate / endDate all optional). A hand-written JPQL query with
 * "(:param IS NULL OR field = :param)" placeholders was deliberately avoided here - see
 * AuditLogRepository for the same lesson (Postgres can't infer the type of an untyped NULL bound
 * against a typed column) - Specifications only add a predicate for filters that are present.
 */
@Repository
public interface BankTransactionRepository extends JpaRepository<BankTransaction, UUID>,
        JpaSpecificationExecutor<BankTransaction> {

    boolean existsByTxnDateAndAmountAndDescriptionAndDeletedFalse(
            LocalDate txnDate, BigDecimal amount, String description);

    long countByReconciledAndDeletedFalse(boolean reconciled);

    @Query("SELECT COALESCE(SUM(bt.amount), 0) FROM BankTransaction bt " +
            "WHERE bt.reconciled = false AND bt.deleted = false")
    BigDecimal sumUnreconciledAmount();

    @Query("SELECT bt.matchedPayment.id FROM BankTransaction bt " +
            "WHERE bt.matchedPayment IS NOT NULL AND bt.deleted = false")
    List<UUID> findMatchedPaymentIds();

    // DATA INTEGRITY fix (post-overhaul audit): backs BankReconciliationService#match's guard
    // against matching a payment that's already matched to a different bank transaction.
    Optional<BankTransaction> findByMatchedPaymentIdAndDeletedFalse(UUID matchedPaymentId);
}
