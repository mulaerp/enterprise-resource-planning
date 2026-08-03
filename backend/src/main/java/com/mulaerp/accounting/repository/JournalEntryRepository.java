package com.mulaerp.accounting.repository;

import com.mulaerp.accounting.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, UUID> {
    
    Optional<JournalEntry> findByEntryNumberAndDeletedFalse(String entryNumber);
    
    List<JournalEntry> findByDeletedFalse();
    
    List<JournalEntry> findByStatusAndDeletedFalse(JournalEntry.JournalEntryStatus status);
    
    List<JournalEntry> findByEntryDateBetweenAndDeletedFalse(LocalDate startDate, LocalDate endDate);

    // Backs BankReconciliationService's clearing-entry reversal on unmatch - every auto-journal
    // hook in this codebase stamps its source document number onto JournalEntry.reference (PoS
    // sale number, payment number, repair job number, ...), so this is how the clearing entry
    // posted for a given payment (see CashAccountResolver / BankReconciliationService#match) is
    // found again when the match is later undone.
    List<JournalEntry> findByReferenceAndDeletedFalse(String reference);

    // Backs the drafts preview / post-batch-by-range fix (WP: books reporting zero because every
    // auto-journal hook posts DRAFT and nothing ever bulk-posts them) - scoped to a status AND a
    // date range in one query rather than filtering findByStatusAndDeletedFalse() in memory.
    List<JournalEntry> findByStatusAndEntryDateBetweenAndDeletedFalse(
            JournalEntry.JournalEntryStatus status, LocalDate startDate, LocalDate endDate);

    // Backs the P&L/balance-sheet "N unposted entries excluded" advisory
    // (FinancialStatementService) - FinancialStatementService itself only ever counts POSTED
    // activity, so these let it report how many DRAFTs in the period/as-of-date it deliberately
    // left out, without pulling the full entries into memory just to size() them.
    long countByStatusAndEntryDateBetweenAndDeletedFalse(
            JournalEntry.JournalEntryStatus status, LocalDate startDate, LocalDate endDate);

    long countByStatusAndEntryDateLessThanEqualAndDeletedFalse(
            JournalEntry.JournalEntryStatus status, LocalDate asOfDate);

    @Query("SELECT je FROM JournalEntry je WHERE je.deleted = false ORDER BY je.entryDate DESC, je.entryNumber DESC")
    List<JournalEntry> findAllOrderByDateDesc();
    
    // Bounded to exactly the 6-digit sequence (positions 3-8) rather than the full remainder of
    // the string, so it still parses correctly now that generateEntryNumber() appends a
    // "-<hex>" uniqueness suffix after those 6 digits (see AccountingService#generateEntryNumber).
    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(je.entryNumber, 3, 6) AS int)), 0) FROM JournalEntry je " +
           "WHERE je.entryNumber LIKE 'JE%'")
    Integer findMaxEntryNumber();
}
