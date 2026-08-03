package com.mulaerp.accounting.repository;

import com.mulaerp.accounting.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {
    
    Optional<Account> findByCodeAndDeletedFalse(String code);
    
    List<Account> findByDeletedFalse();
    
    List<Account> findByAccountTypeAndDeletedFalse(Account.AccountType accountType);
    
    List<Account> findByParentIdAndDeletedFalse(UUID parentId);
    
    // WP (cash-leg split, V35): used by AccountingService#getTrialBalance. Deliberately does NOT
    // filter on isActive - "active" only gates whether an account can be picked as the target of a
    // NEW manual journal entry (enforced client-side, see JournalEntryFormPage.tsx's isActive
    // filter on its account dropdown); it is not a "hide from reports" flag. Account 1110 "Cash
    // and Cash Equivalents" is the concrete case this matters for: V35 marks it inactive (posted
    // history stays exactly where it is, by design) while it can still carry a real non-zero
    // balance from before the split - a trial balance that silently dropped an inactive account's
    // balance would stop being a trial balance (debits would no longer equal credits). Excludes
    // only soft-deleted accounts, same as every other report in this module.
    @Query("SELECT a FROM Account a WHERE a.deleted = false ORDER BY a.code")
    List<Account> findAllNonDeletedOrderByCode();
    
    @Query("SELECT a FROM Account a WHERE a.deleted = false AND " +
           "(LOWER(a.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(a.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Account> searchAccounts(String search);
}
