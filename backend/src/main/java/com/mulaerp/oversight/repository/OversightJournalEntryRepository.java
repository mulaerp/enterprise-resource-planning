package com.mulaerp.oversight.repository;

import com.mulaerp.accounting.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * OVERSIGHT: read-only secondary repository over {@link JournalEntry} - see
 * OversightPosSaleRepository javadoc for the pattern. Backs
 * {@link com.mulaerp.oversight.service.MoneyFlowService}'s posted-journal cross-check: when the
 * operational and posted-journal revenue figures disagree, this finds which (if any) DRAFT entries
 * in the period are the reason, so the banner can name them instead of just saying "mismatch".
 */
@Repository
public interface OversightJournalEntryRepository extends JpaRepository<JournalEntry, UUID> {

    List<JournalEntry> findByStatusAndEntryDateBetweenAndDeletedFalse(
            JournalEntry.JournalEntryStatus status, LocalDate from, LocalDate to);
}
