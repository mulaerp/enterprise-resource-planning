package com.mulaerp.accounting.repository;

import com.mulaerp.accounting.entity.JournalEntryLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface JournalEntryLineRepository extends JpaRepository<JournalEntryLine, UUID> {

    List<JournalEntryLine> findByJournalEntryId(UUID entryId);

    List<JournalEntryLine> findByAccountId(UUID accountId);

    @Query("SELECT jel FROM JournalEntryLine jel " +
           "JOIN jel.journalEntry je " +
           "WHERE jel.account.id = :accountId AND je.status = 'POSTED' " +
           "ORDER BY je.entryDate, je.entryNumber")
    List<JournalEntryLine> findPostedLinesByAccount(@Param("accountId") UUID accountId);

    /**
     * Sums debits/credits per account for POSTED, non-deleted journal entries whose
     * entryDate falls within [startDate, endDate] (inclusive). Used by the P&L report.
     * Each row: [accountId (UUID), totalDebit (BigDecimal), totalCredit (BigDecimal)]
     */
    @Query("SELECT jel.account.id, COALESCE(SUM(jel.debit), 0), COALESCE(SUM(jel.credit), 0) " +
           "FROM JournalEntryLine jel JOIN jel.journalEntry je " +
           "WHERE je.status = 'POSTED' AND je.deleted = false " +
           "AND je.entryDate BETWEEN :startDate AND :endDate " +
           "GROUP BY jel.account.id")
    List<Object[]> sumActivityByAccountBetweenDates(@Param("startDate") LocalDate startDate,
                                                      @Param("endDate") LocalDate endDate);

    /**
     * Sums debits/credits per account for POSTED, non-deleted journal entries whose
     * entryDate is on or before asOfDate. Used by the balance sheet report.
     * Each row: [accountId (UUID), totalDebit (BigDecimal), totalCredit (BigDecimal)]
     */
    @Query("SELECT jel.account.id, COALESCE(SUM(jel.debit), 0), COALESCE(SUM(jel.credit), 0) " +
           "FROM JournalEntryLine jel JOIN jel.journalEntry je " +
           "WHERE je.status = 'POSTED' AND je.deleted = false " +
           "AND je.entryDate <= :asOfDate " +
           "GROUP BY jel.account.id")
    List<Object[]> sumActivityByAccountUpToDate(@Param("asOfDate") LocalDate asOfDate);
}
