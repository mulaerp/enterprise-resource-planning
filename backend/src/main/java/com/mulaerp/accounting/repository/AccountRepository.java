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
    
    @Query("SELECT a FROM Account a WHERE a.deleted = false AND a.isActive = true ORDER BY a.code")
    List<Account> findAllActive();
    
    @Query("SELECT a FROM Account a WHERE a.deleted = false AND " +
           "(LOWER(a.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(a.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Account> searchAccounts(String search);
}
