package com.mulaerp.accounting.service;

import com.mulaerp.accounting.dto.AccountDTO;
import com.mulaerp.accounting.dto.DraftPreviewDTO;
import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.dto.PostBatchRequest;
import com.mulaerp.accounting.dto.PostBatchResultDTO;
import com.mulaerp.accounting.dto.TrialBalanceDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.entity.JournalEntry;
import com.mulaerp.accounting.entity.JournalEntryLine;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.repository.JournalEntryLineRepository;
import com.mulaerp.accounting.repository.JournalEntryRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class AccountingService {

    private final AccountRepository accountRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final JournalEntryLineRepository journalEntryLineRepository;

    // WP: "books report zero by default" fix - when true, entries created via createSystemEntry()
    // (the SYSTEM auto-journal hooks: PoS sale/COGS, trade-in, invoice, payment, repair) are
    // POSTED immediately in the same transaction as their creation, instead of sitting as DRAFT
    // until someone runs the bulk post-batch endpoint. Manual entries (AccountingController's
    // POST /journal-entries, via createJournalEntry()) are NEVER affected by this flag - they
    // always land as DRAFT and require an explicit human post, which is the legitimate review
    // step for hand-written adjustments.
    @Value("${mulaerp.accounting.auto-post-system-entries:true}")
    private boolean autoPostSystemEntries;

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

    /**
     * Manual entry creation ({@code POST /accounting/journal-entries}, {@link
     * com.mulaerp.accounting.controller.AccountingController}) - always lands as DRAFT regardless
     * of {@link #autoPostSystemEntries}. Hand-written adjustments legitimately need an explicit
     * human review/post step; this method must never auto-post.
     */
    @CacheEvict(value = "accounts", allEntries = true)
    public JournalEntryDTO createJournalEntry(JournalEntryDTO dto) {
        return buildAndSaveEntry(dto, false);
    }

    /**
     * Entry creation for the SYSTEM auto-journal hooks only (PoS sale revenue/COGS, trade-in,
     * invoice, payment, repair collection/parts/deposit) - see call sites in
     * PosSaleService/PosTradeInService/InvoiceService/PaymentService/RepairJobService, each routed
     * through {@link com.mulaerp.common.service.NonBlockingHookExecutor#runInNewTransaction} so a
     * posting failure here can never roll back the business transaction that triggered it.
     *
     * <p>When {@link #autoPostSystemEntries} is true (default), the entry is posted immediately
     * in this same call - same {@link #postEntryInternal} validation + {@code Account.balance}
     * update path as {@link #postJournalEntry}, so the trial balance/P&amp;L/balance sheet reflect
     * it right away instead of waiting on a manual bulk post-batch. When false, behaves exactly
     * like {@link #createJournalEntry} (DRAFT).
     */
    @CacheEvict(value = "accounts", allEntries = true)
    public JournalEntryDTO createSystemEntry(JournalEntryDTO dto) {
        return buildAndSaveEntry(dto, autoPostSystemEntries);
    }

    private JournalEntryDTO buildAndSaveEntry(JournalEntryDTO dto, boolean autoPost) {
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

        // Always persist as DRAFT first (INSERT of the entry row + its lines together). The
        // trg_journal_entry_balanced constraint trigger (V22) is DEFERRABLE INITIALLY IMMEDIATE -
        // it fires right after each INSERT/UPDATE on journal_entries, and Hibernate inserts the
        // parent row before its cascaded child lines. Setting status=POSTED on a brand-new,
        // not-yet-saved entity in the same insert would therefore trip "cannot be POSTED: it has
        // no lines" (line_count is read from journal_entry_lines, still empty at that point).
        // Saving as DRAFT here first guarantees the lines exist before any POSTED transition.
        entry = journalEntryRepository.save(entry);

        if (autoPost) {
            // Same validation + Account.balance update path as postJournalEntry/postBatch - this
            // is now a status UPDATE on an already-persisted entry (lines already in the DB), so
            // the constraint trigger's line-count/balance check passes exactly as it does for a
            // manually-posted entry.
            postEntryInternal(entry);
            entry = journalEntryRepository.save(entry);
        }

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

        postEntryInternal(entry);
        entry = journalEntryRepository.save(entry);
        return JournalEntryDTO.fromEntity(entry);
    }

    /**
     * WP: fixes the "books report zero" audit finding - every auto-journal hook
     * (invoice/payment/PoS/repair) posts a DRAFT entry and the only way to POST one was
     * one-at-a-time via {@link #postJournalEntry}, so ~180 real transactions never reached the
     * trial balance / P&amp;L / balance sheet. Posts every resolved entry inside this single
     * {@code @Transactional} method - Spring rolls back the whole batch if any entry fails
     * validation (not a draft, unbalanced, not found), so this is genuinely all-or-nothing.
     */
    @CacheEvict(value = "accounts", allEntries = true)
    public PostBatchResultDTO postBatch(PostBatchRequest request) {
        List<JournalEntry> entries = resolveBatchEntries(request);
        if (entries.isEmpty()) {
            throw new IllegalArgumentException("No draft journal entries found to post");
        }

        BigDecimal totalDebits = BigDecimal.ZERO;
        BigDecimal totalCredits = BigDecimal.ZERO;

        for (JournalEntry entry : entries) {
            postEntryInternal(entry);
            for (JournalEntryLine line : entry.getLines()) {
                totalDebits = totalDebits.add(line.getDebit());
                totalCredits = totalCredits.add(line.getCredit());
            }
        }

        journalEntryRepository.saveAll(entries);
        return new PostBatchResultDTO(entries.size(), totalDebits, totalCredits);
    }

    private List<JournalEntry> resolveBatchEntries(PostBatchRequest request) {
        if (request.getEntryIds() != null && !request.getEntryIds().isEmpty()) {
            List<JournalEntry> entries = journalEntryRepository.findAllById(request.getEntryIds());
            if (entries.size() != request.getEntryIds().size()) {
                throw new ResourceNotFoundException("One or more journal entries in entryIds were not found");
            }
            return entries;
        }
        if (request.getStartDate() != null && request.getEndDate() != null) {
            return journalEntryRepository.findByStatusAndEntryDateBetweenAndDeletedFalse(
                    JournalEntry.JournalEntryStatus.DRAFT, request.getStartDate(), request.getEndDate());
        }
        throw new IllegalArgumentException("Either entryIds or startDate/endDate must be provided");
    }

    /** Shared validate-then-post logic for both the single-entry and batch posting endpoints. */
    private void postEntryInternal(JournalEntry entry) {
        if (entry.getDeleted()) {
            throw new ResourceNotFoundException("Journal entry not found: " + entry.getId());
        }
        if (entry.getStatus() != JournalEntry.JournalEntryStatus.DRAFT) {
            throw new IllegalStateException(String.format(
                    "Journal entry %s is not a draft (status: %s) and cannot be posted",
                    entry.getEntryNumber(), entry.getStatus()));
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
    }

    /**
     * Read-side of the drafts fix: lists outstanding DRAFT entries in the given range (or all
     * DRAFTs when no range is given), grouped by source so a reviewer can see "94 PoS sales, 12
     * invoices, ..." rather than 180 anonymous rows, with a per-account debit/credit subtotal
     * inside each group and a running grand total. Purely a read - never mutates anything.
     */
    public DraftPreviewDTO getDraftsPreview(LocalDate startDate, LocalDate endDate) {
        List<JournalEntry> drafts = (startDate != null && endDate != null)
                ? journalEntryRepository.findByStatusAndEntryDateBetweenAndDeletedFalse(
                        JournalEntry.JournalEntryStatus.DRAFT, startDate, endDate)
                : journalEntryRepository.findByStatusAndDeletedFalse(JournalEntry.JournalEntryStatus.DRAFT);

        Map<String, List<JournalEntry>> bySource = new LinkedHashMap<>();
        drafts.stream()
                .sorted((a, b) -> a.getEntryDate().compareTo(b.getEntryDate()))
                .forEach(entry -> bySource.computeIfAbsent(deriveSource(entry), k -> new ArrayList<>()).add(entry));

        List<DraftPreviewDTO.SourceGroup> groups = new ArrayList<>();
        BigDecimal grandDebits = BigDecimal.ZERO;
        BigDecimal grandCredits = BigDecimal.ZERO;

        for (Map.Entry<String, List<JournalEntry>> sourceEntries : bySource.entrySet()) {
            List<JournalEntry> groupEntries = sourceEntries.getValue();
            Map<UUID, DraftPreviewDTO.AccountSubtotal> accountTotals = new LinkedHashMap<>();
            BigDecimal groupDebits = BigDecimal.ZERO;
            BigDecimal groupCredits = BigDecimal.ZERO;
            List<UUID> entryIds = new ArrayList<>();

            for (JournalEntry entry : groupEntries) {
                entryIds.add(entry.getId());
                for (JournalEntryLine line : entry.getLines()) {
                    Account account = line.getAccount();
                    DraftPreviewDTO.AccountSubtotal subtotal = accountTotals.computeIfAbsent(account.getId(),
                            k -> new DraftPreviewDTO.AccountSubtotal(account.getCode(), account.getName(),
                                    BigDecimal.ZERO, BigDecimal.ZERO));
                    subtotal.setDebit(subtotal.getDebit().add(line.getDebit()));
                    subtotal.setCredit(subtotal.getCredit().add(line.getCredit()));
                    groupDebits = groupDebits.add(line.getDebit());
                    groupCredits = groupCredits.add(line.getCredit());
                }
            }

            List<DraftPreviewDTO.AccountSubtotal> subtotals = new ArrayList<>(accountTotals.values());
            subtotals.sort((a, b) -> a.getAccountCode().compareTo(b.getAccountCode()));

            groups.add(new DraftPreviewDTO.SourceGroup(sourceEntries.getKey(), groupEntries.size(),
                    groupDebits, groupCredits, entryIds, subtotals));
            grandDebits = grandDebits.add(groupDebits);
            grandCredits = grandCredits.add(groupCredits);
        }

        return new DraftPreviewDTO(startDate, endDate, drafts.size(), grandDebits, grandCredits, groups);
    }

    /**
     * Every auto-journal hook (PoS/invoice/payment/repair) writes
     * {@code "Auto-generated: <Source> <number>"} - see PosSaleService/InvoiceService/
     * PaymentService/RepairJobService. Matched against the known source labels rather than a
     * generic regex so grouping stays stable regardless of how a document number is formatted;
     * anything not matching a known auto-journal label (including entries with no
     * "Auto-generated: " prefix at all) falls back to "Manual".
     */
    private String deriveSource(JournalEntry entry) {
        String description = entry.getDescription();
        if (description == null || !description.startsWith("Auto-generated: ")) {
            return "Manual";
        }
        String rest = description.substring("Auto-generated: ".length());
        if (rest.startsWith("PoS Sale")) {
            return "PoS Sale";
        }
        if (rest.startsWith("Invoice")) {
            return "Invoice";
        }
        if (rest.startsWith("Payment")) {
            return "Payment";
        }
        if (rest.startsWith("Repair Job")) {
            return "Repair Job";
        }
        String[] words = rest.trim().split("\\s+");
        return words.length >= 2 ? words[0] + " " + words[1] : (words.length == 1 ? words[0] : "Other");
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
        // WP (cash-leg split, V35): see AccountRepository#findAllNonDeletedOrderByCode javadoc -
        // this must include inactive accounts (e.g. 1110 post-split) or the trial balance can stop
        // balancing whenever an inactive account still carries a real historical balance.
        List<Account> accounts = accountRepository.findAllNonDeletedOrderByCode();
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

    // findMaxEntryNumber() reads the current max sequence with no locking, so two concurrent
    // journal entry creations can read the same max and compute the same nextNumber - append a
    // random hex suffix so the final number is unique by construction even when that race
    // happens. See JournalEntryRepository#findMaxEntryNumber for the matching parse-side change.
    private String generateEntryNumber() {
        Integer maxNumber = journalEntryRepository.findMaxEntryNumber();
        int nextNumber = (maxNumber != null ? maxNumber : 0) + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return String.format("JE%06d-%s", nextNumber, suffix);
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
