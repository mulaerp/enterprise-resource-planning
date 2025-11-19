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
    
    @Query("SELECT je FROM JournalEntry je WHERE je.deleted = false ORDER BY je.entryDate DESC, je.entryNumber DESC")
    List<JournalEntry> findAllOrderByDateDesc();
    
    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(je.entryNumber, 3) AS int)), 0) FROM JournalEntry je " +
           "WHERE je.entryNumber LIKE 'JE%'")
    Integer findMaxEntryNumber();
}
