package com.mulaerp.accounting.repository;

import com.mulaerp.accounting.entity.JournalEntryLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}
