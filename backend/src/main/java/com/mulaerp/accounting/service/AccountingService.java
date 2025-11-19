package com.mulaerp.accounting.service;

import com.mulaerp.accounting.dto.AccountDTO;
import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.dto.TrialBalanceDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.entity.JournalEntry;
import com.mulaerp.accounting.entity.JournalEntryLine;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.repository.JournalEntryLineRepository;
import com.mulaerp.accounting.repository.JournalEntryRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AccountingService {

    private final AccountRepository accountRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final JournalEntryLineRepository journalEntryLineRepository;

    // ============================================
    // Account Management
    // ============================================

    @Cacheable(value = "accounts", key = "'all'")
    public List<AccountDTO> getAllAccounts() {
        return accountRepository.findByDeletedFalse().stream()
            .map(AccountDTO::fromEntity)
            .collect(Collectors.toList());
    }

    @Cacheable(value = "accounts", key = "#id")
    public AccountDTO getAccountById(UUID id) {
        Account account = accountRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        return AccountDTO.fromEntity(account);
    }

    public AccountDTO getAccountByCode(String code) {
        Account account = accountRepository.findByCodeAndDeletedFalse(code)
            .orElseThrow(() -> new ResourceNotFoundException("Account not found with code: " + code));
        return AccountDTO.fromEntity(account);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public AccountDTO createAccount(AccountDTO dto) {
        if (accountRepository.findByCodeAndDeletedFalse(dto.getCode()).isPresent()) {
            throw new IllegalArgumentException("Account code already exists: " + dto.getCode());
        }

        Account account = new Account();
        account.setCode(dto.getCode());
        account.setName(dto.getName());
        account.setAccountType(dto.getAccountType());
        account.setParentId(dto.getParentId());
        account.setBalance(dto.getBalance() != null ? dto.getBalance() : BigDecimal.ZERO);
        account.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
        account.setDescription(dto.getDescription());

        account = accountRepository.save(account);
        return AccountDTO.fromEntity(account);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public AccountDTO updateAccount(UUID id, AccountDTO dto) {
        Account account = accountRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        if (!account.getCode().equals(dto.getCode()) &&
            accountRepository.findByCodeAndDeletedFalse(dto.getCode()).isPresent()) {
            throw new IllegalArgumentException("Account code already exists: " + dto.getCode());
        }

        account.setCode(dto.getCode());
        account.setName(dto.getName());
        account.setAccountType(dto.getAccountType());
        account.setParentId(dto.getParentId());
        account.setIsActive(dto.getIsActive());
        account.setDescription(dto.getDescription());

        account = accountRepository.save(account);
        return AccountDTO.fromEntity(account);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public void deleteAccount(UUID id) {
        Account account = accountRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        // Check if account has posted journal entries
        List<JournalEntryLine> postedLines = journalEntryLineRepository.findPostedLinesByAccount(id);
        if (!postedLines.isEmpty()) {
            throw new IllegalStateException("Cannot delete account with posted journal entries");
        }

        account.setDeleted(true);
        accountRepository.save(account);
    }

    public List<AccountDTO> searchAccounts(String search) {
        return accountRepository.searchAccounts(search).stream()
            .map(AccountDTO::fromEntity)
            .collect(Collectors.toList());
    }

    // ============================================
    // Journal Entry Management
    // ============================================

    public List<JournalEntryDTO> getAllJournalEntries() {
        return journalEntryRepository.findAllOrderByDateDesc().stream()
            .map(JournalEntryDTO::fromEntity)
            .collect(Collectors.toList());
    }

    public JournalEntryDTO getJournalEntryById(UUID id) {
        JournalEntry entry = journalEntryRepository.findById(id)
            .filter(je -> !je.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Journal entry not found"));
        return JournalEntryDTO.fromEntity(entry);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public JournalEntryDTO createJournalEntry(JournalEntryDTO dto) {
        // Generate entry number
        String entryNumber = generateEntryNumber();

        JournalEntry entry = new JournalEntry();
        entry.setEntryNumber(entryNumber);
        entry.setEntryDate(dto.getEntryDate() != null ? dto.getEntryDate() : LocalDate.now());
        entry.setDescription(dto.getDescription());
        entry.setStatus(JournalEntry.JournalEntryStatus.DRAFT);
        entry.setReference(dto.getReference());

        // Add lines
        for (JournalEntryLineDTO lineDto : dto.getLines()) {
            Account account = accountRepository.findById(lineDto.getAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found: " + lineDto.getAccountId()));

            JournalEntryLine line = new JournalEntryLine();
            line.setAccount(account);
            line.setDebit(lineDto.getDebit() != null ? lineDto.getDebit() : BigDecimal.ZERO);
            line.setCredit(lineDto.getCredit() != null ? lineDto.getCredit() : BigDecimal.ZERO);
            line.setDescription(lineDto.getDescription());

            entry.addLine(line);
        }

        // Validate balanced entry
        validateBalancedEntry(entry);

        entry = journalEntryRepository.save(entry);
        return JournalEntryDTO.fromEntity(entry);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public JournalEntryDTO updateJournalEntry(UUID id, JournalEntryDTO dto) {
        JournalEntry entry = journalEntryRepository.findById(id)
            .filter(je -> !je.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Journal entry not found"));

        if (entry.getStatus() == JournalEntry.JournalEntryStatus.POSTED) {
            throw new IllegalStateException("Cannot update posted journal entry");
        }

        entry.setEntryDate(dto.getEntryDate());
        entry.setDescription(dto.getDescription());
        entry.setReference(dto.getReference());

        // Clear existing lines
        entry.getLines().clear();

        // Add new lines
        for (JournalEntryLineDTO lineDto : dto.getLines()) {
            Account account = accountRepository.findById(lineDto.getAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found: " + lineDto.getAccountId()));

            JournalEntryLine line = new JournalEntryLine();
            line.setAccount(account);
            line.setDebit(lineDto.getDebit() != null ? lineDto.getDebit() : BigDecimal.ZERO);
            line.setCredit(lineDto.getCredit() != null ? lineDto.getCredit() : BigDecimal.ZERO);
            line.setDescription(lineDto.getDescription());

            entry.addLine(line);
        }

        validateBalancedEntry(entry);

        entry = journalEntryRepository.save(entry);
        return JournalEntryDTO.fromEntity(entry);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public JournalEntryDTO postJournalEntry(UUID id) {
        JournalEntry entry = journalEntryRepository.findById(id)
            .filter(je -> !je.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Journal entry not found"));

        if (entry.getStatus() == JournalEntry.JournalEntryStatus.POSTED) {
            throw new IllegalStateException("Journal entry already posted");
        }

        validateBalancedEntry(entry);

        // Update account balances
        for (JournalEntryLine line : entry.getLines()) {
            Account account = line.getAccount();
            BigDecimal change = line.getDebit().subtract(line.getCredit());
            
            // For asset and expense accounts, debit increases balance
            // For liability, equity, and revenue accounts, credit increases balance
            if (account.getAccountType() == Account.AccountType.ASSET ||
                account.getAccountType() == Account.AccountType.EXPENSE) {
                account.setBalance(account.getBalance().add(change));
            } else {
                account.setBalance(account.getBalance().subtract(change));
            }
            
            accountRepository.save(account);
        }

        entry.setStatus(JournalEntry.JournalEntryStatus.POSTED);
        entry = journalEntryRepository.save(entry);
        return JournalEntryDTO.fromEntity(entry);
    }

    @CacheEvict(value = "accounts", allEntries = true)
    public void deleteJournalEntry(UUID id) {
        JournalEntry entry = journalEntryRepository.findById(id)
            .filter(je -> !je.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Journal entry not found"));

        if (entry.getStatus() == JournalEntry.JournalEntryStatus.POSTED) {
            throw new IllegalStateException("Cannot delete posted journal entry. Cancel it first.");
        }

        entry.setDeleted(true);
        journalEntryRepository.save(entry);
    }

    // ============================================
    // Reports
    // ============================================

    public TrialBalanceDTO getTrialBalance() {
        List<Account> accounts = accountRepository.findAllActive();
        List<TrialBalanceDTO.TrialBalanceItem> items = new ArrayList<>();
        
        BigDecimal totalDebits = BigDecimal.ZERO;
        BigDecimal totalCredits = BigDecimal.ZERO;

        for (Account account : accounts) {
            BigDecimal balance = account.getBalance();
            
            TrialBalanceDTO.TrialBalanceItem item = new TrialBalanceDTO.TrialBalanceItem();
            item.setAccountCode(account.getCode());
            item.setAccountName(account.getName());
            
            // Determine if balance is debit or credit based on account type
            if (account.getAccountType() == Account.AccountType.ASSET ||
                account.getAccountType() == Account.AccountType.EXPENSE) {
                item.setDebit(balance.compareTo(BigDecimal.ZERO) >= 0 ? balance : BigDecimal.ZERO);
                item.setCredit(balance.compareTo(BigDecimal.ZERO) < 0 ? balance.abs() : BigDecimal.ZERO);
            } else {
                item.setCredit(balance.compareTo(BigDecimal.ZERO) >= 0 ? balance : BigDecimal.ZERO);
                item.setDebit(balance.compareTo(BigDecimal.ZERO) < 0 ? balance.abs() : BigDecimal.ZERO);
            }
            
            totalDebits = totalDebits.add(item.getDebit());
            totalCredits = totalCredits.add(item.getCredit());
            
            items.add(item);
        }

        TrialBalanceDTO trialBalance = new TrialBalanceDTO();
        trialBalance.setItems(items);
        trialBalance.setTotalDebits(totalDebits);
        trialBalance.setTotalCredits(totalCredits);
        trialBalance.setBalanced(totalDebits.compareTo(totalCredits) == 0);

        return trialBalance;
    }

    public List<JournalEntryLineDTO> getAccountLedger(UUID accountId) {
        List<JournalEntryLine> lines = journalEntryLineRepository.findPostedLinesByAccount(accountId);
        return lines.stream()
            .map(JournalEntryLineDTO::fromEntity)
            .collect(Collectors.toList());
    }

    // ============================================
    // Helper Methods
    // ============================================

    private String generateEntryNumber() {
        Integer maxNumber = journalEntryRepository.findMaxEntryNumber();
        int nextNumber = (maxNumber != null ? maxNumber : 0) + 1;
        return String.format("JE%06d", nextNumber);
    }

    private void validateBalancedEntry(JournalEntry entry) {
        BigDecimal totalDebits = BigDecimal.ZERO;
        BigDecimal totalCredits = BigDecimal.ZERO;

        for (JournalEntryLine line : entry.getLines()) {
            totalDebits = totalDebits.add(line.getDebit());
            totalCredits = totalCredits.add(line.getCredit());
        }

        if (totalDebits.compareTo(totalCredits) != 0) {
            throw new IllegalArgumentException(
                String.format("Journal entry is not balanced. Debits: %s, Credits: %s", 
                    totalDebits, totalCredits));
        }

        if (totalDebits.compareTo(BigDecimal.ZERO) == 0) {
            throw new IllegalArgumentException("Journal entry must have at least one debit and one credit");
        }
    }
}
