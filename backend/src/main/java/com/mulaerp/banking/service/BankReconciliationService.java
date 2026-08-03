package com.mulaerp.banking.service;

import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.entity.JournalEntry;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.repository.JournalEntryRepository;
import com.mulaerp.accounting.service.AccountingService;
import com.mulaerp.accounting.service.CashAccountResolver;
import com.mulaerp.banking.dto.BankImportResultDTO;
import com.mulaerp.banking.dto.BankSummaryDTO;
import com.mulaerp.banking.dto.BankTransactionDTO;
import com.mulaerp.banking.dto.MatchPaymentRequest;
import com.mulaerp.banking.dto.PaymentSuggestionDTO;
import com.mulaerp.banking.entity.BankTransaction;
import com.mulaerp.banking.repository.BankPaymentLookupRepository;
import com.mulaerp.banking.repository.BankTransactionRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.payment.entity.Payment;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * ACC-BANK: bank statement import + reconciliation against existing payments.
 *
 * <p>WP (cash-leg split, V35): a successful {@link #match} also posts a non-blocking system
 * clearing entry (see {@link #postClearingEntry}) moving the payment's amount from its clearing
 * account (1112 Card Clearing / 1113 E-Wallet Clearing - see CashAccountResolver) to 1114 Bank
 * Account, since a bank statement match is exactly the evidence that the money actually landed in
 * the bank. Nothing is posted when the payment was already CASH (1111, never touches the bank) or
 * already BANK_TRANSFER/CHECK (1114 directly, nothing left to clear) or STORE_CREDIT (2140, never
 * a real bank movement). {@link #unmatch} reverses that same clearing entry (see
 * {@link #reverseClearingEntry}) - it is derived by reading back the lines the original clearing
 * entry actually posted (via its {@code reference} = the payment number), never recomputed/
 * re-hardcoded, so it stays correct even if the mapping ever changes later.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BankReconciliationService {

    private static final int MATCH_WINDOW_DAYS = 3;

    /** JournalEntry.description prefixes used to find/pair a clearing entry with its reversal -
     * see #postClearingEntry / #reverseClearingEntry. Both are unique per payment (paymentNumber
     * is unique), and distinct from every other auto-journal hook's own "Auto-generated: ..."
     * description (see AccountingService#deriveSource for the full list this must not collide with). */
    private static final String CLEARING_DESC_PREFIX = "Auto-generated: Bank Clearing - Payment ";
    private static final String CLEARING_REVERSAL_DESC_PREFIX = "Auto-generated: Bank Clearing Reversal - Payment ";

    private final BankTransactionRepository bankTransactionRepository;
    private final BankPaymentLookupRepository bankPaymentLookupRepository;
    private final AccountRepository accountRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final AccountingService accountingService;
    private final CashAccountResolver cashAccountResolver;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;
    private final BankStatementParser bankStatementParser = new BankStatementParser();

    @Transactional
    public BankImportResultDTO importStatement(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Statement file is required");
        }

        BankStatementParser.ParseResult parseResult;
        try {
            parseResult = bankStatementParser.parse(file.getInputStream());
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read statement file: " + e.getMessage());
        }

        UUID importBatchId = UUID.randomUUID();
        int imported = 0;
        int duplicates = 0;

        for (BankStatementParser.ParsedRow row : parseResult.getRows()) {
            boolean isDuplicate = bankTransactionRepository.existsByTxnDateAndAmountAndDescriptionAndDeletedFalse(
                    row.txnDate(), row.amount(), row.description());
            if (isDuplicate) {
                duplicates++;
                continue;
            }

            BankTransaction txn = new BankTransaction();
            txn.setTxnDate(row.txnDate());
            txn.setDescription(row.description());
            txn.setAmount(row.amount());
            txn.setReference(row.reference());
            txn.setSourceFilename(file.getOriginalFilename());
            txn.setReconciled(false);
            txn.setImportBatchId(importBatchId);
            bankTransactionRepository.save(txn);
            imported++;
        }

        return new BankImportResultDTO(importBatchId, imported, parseResult.getSkipped(), duplicates);
    }

    @Transactional(readOnly = true)
    public Page<BankTransactionDTO> getTransactions(Boolean reconciled, LocalDate startDate, LocalDate endDate,
                                                      Pageable pageable) {
        Specification<BankTransaction> spec = buildSpecification(reconciled, startDate, endDate);
        return bankTransactionRepository.findAll(spec, pageable).map(this::toDto);
    }

    private Specification<BankTransaction> buildSpecification(Boolean reconciled, LocalDate startDate,
                                                                LocalDate endDate) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (reconciled != null) {
                predicates.add(cb.equal(root.get("reconciled"), reconciled));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("txnDate"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("txnDate"), endDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public List<PaymentSuggestionDTO> getSuggestions(UUID transactionId) {
        BankTransaction txn = getTransactionOrThrow(transactionId);

        LocalDate start = txn.getTxnDate().minusDays(MATCH_WINDOW_DAYS);
        LocalDate end = txn.getTxnDate().plusDays(MATCH_WINDOW_DAYS);

        List<UUID> alreadyMatched = bankTransactionRepository.findMatchedPaymentIds();

        List<Payment> candidates = bankPaymentLookupRepository
                .findByAmountAndPaymentDateBetween(txn.getAmount(), start, end);

        return candidates.stream()
                .filter(p -> !alreadyMatched.contains(p.getId()) || p.getId().equals(getMatchedPaymentId(txn)))
                .map(p -> new PaymentSuggestionDTO(
                        p.getId(),
                        p.getPaymentNumber(),
                        p.getPaymentDate(),
                        p.getAmount(),
                        Math.abs(ChronoUnit.DAYS.between(txn.getTxnDate(), p.getPaymentDate()))))
                .sorted(Comparator.comparingLong(PaymentSuggestionDTO::getDaysDifference))
                .toList();
    }

    private UUID getMatchedPaymentId(BankTransaction txn) {
        return txn.getMatchedPayment() != null ? txn.getMatchedPayment().getId() : null;
    }

    @Transactional
    public BankTransactionDTO match(UUID transactionId, MatchPaymentRequest request) {
        BankTransaction txn = getTransactionOrThrow(transactionId);

        Payment payment = bankPaymentLookupRepository.findById(request.getPaymentId())
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));

        if (!request.isForce() && payment.getAmount().compareTo(txn.getAmount()) != 0) {
            throw new IllegalArgumentException(
                    "Payment amount " + payment.getAmount() + " does not match transaction amount "
                            + txn.getAmount() + " - pass force=true to override");
        }

        // DATA INTEGRITY fix (post-overhaul audit): guard against matching a payment that's
        // already matched to a DIFFERENT bank transaction (re-matching the SAME transaction to
        // the same payment - e.g. a retried request - is a no-op below, not an error).
        Optional<BankTransaction> alreadyMatchedTo = bankTransactionRepository
                .findByMatchedPaymentIdAndDeletedFalse(payment.getId());
        if (alreadyMatchedTo.isPresent() && !alreadyMatchedTo.get().getId().equals(transactionId)) {
            throw new IllegalStateException("Payment " + payment.getPaymentNumber()
                    + " is already matched to bank transaction " + alreadyMatchedTo.get().getId());
        }

        // WP (cash-leg split): a genuine first-time match (or a match to a DIFFERENT payment than
        // whatever this transaction was previously matched to) posts a clearing entry below - a
        // retried/no-op match to the SAME payment this transaction is already matched to must NOT
        // post a second one.
        boolean alreadyMatchedToSamePayment = Boolean.TRUE.equals(txn.getReconciled())
                && txn.getMatchedPayment() != null && txn.getMatchedPayment().getId().equals(payment.getId());

        txn.setMatchedPayment(payment);
        txn.setReconciled(true);
        BankTransaction saved = bankTransactionRepository.save(txn);

        if (!alreadyMatchedToSamePayment) {
            postClearingEntry(saved, payment);
        }

        return toDto(saved);
    }

    @Transactional
    public BankTransactionDTO unmatch(UUID transactionId) {
        BankTransaction txn = getTransactionOrThrow(transactionId);
        Payment previouslyMatched = txn.getMatchedPayment();
        txn.setMatchedPayment(null);
        txn.setReconciled(false);
        BankTransaction saved = bankTransactionRepository.save(txn);

        if (previouslyMatched != null) {
            reverseClearingEntry(previouslyMatched);
        }

        return toDto(saved);
    }

    /**
     * Posts Dr 1114 Bank Account / Cr <clearing account> for the payment amount - only when the
     * payment's resolved account is actually a clearing account (Card 1112 or E-Wallet 1113); a
     * CASH (1111), BANK_TRANSFER/CHECK (1114 already), or STORE_CREDIT (2140) payment has nothing
     * to clear to the bank and is skipped. Routed through NonBlockingHookExecutor (REQUIRES_NEW),
     * same pattern as every other auto-journal hook in this codebase - a posting failure here must
     * never fail the match itself.
     */
    private void postClearingEntry(BankTransaction txn, Payment payment) {
        try {
            String clearingCode = cashAccountResolver.resolveCode(payment.getMethod().name());
            if (!CashAccountResolver.CARD_CLEARING.equals(clearingCode) && !CashAccountResolver.EWALLET_CLEARING.equals(clearingCode)) {
                return;
            }

            Optional<Account> bank = accountRepository.findByCodeAndDeletedFalse(CashAccountResolver.BANK_ACCOUNT);
            Optional<Account> clearing = accountRepository.findByCodeAndDeletedFalse(clearingCode);
            if (bank.isEmpty() || clearing.isEmpty()) {
                log.warn("Skipping bank-clearing auto-journal for transaction {}: missing well-known account(s) {}/{}",
                        txn.getId(), CashAccountResolver.BANK_ACCOUNT, clearingCode);
                return;
            }

            JournalEntryLineDTO debit = debitLine(bank.get().getId(), payment.getAmount(),
                    "Bank Account - cleared from " + clearing.get().getName() + " - Payment " + payment.getPaymentNumber());
            JournalEntryLineDTO credit = creditLine(clearing.get().getId(), payment.getAmount(),
                    clearing.get().getName() + " cleared - Payment " + payment.getPaymentNumber());

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription(CLEARING_DESC_PREFIX + payment.getPaymentNumber());
            entry.setReference(payment.getPaymentNumber());
            entry.setLines(List.of(debit, credit));

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create bank-clearing auto-journal entry for payment {}: {}", payment.getPaymentNumber(), e.getMessage());
        }
    }

    /**
     * Reverses the clearing entry {@link #postClearingEntry} posted for this payment, if any -
     * derived by reading back that entry's own lines (debit/credit swapped), never recomputed
     * from the payment method again, so it stays correct even if the payment's method/mapping
     * changed after the fact. Safe to call on a payment that was never cleared (e.g. it was CASH)
     * or whose clearing entry was already reversed (e.g. a repeated unmatch) - both are no-ops,
     * found by comparing how many clearing entries vs. reversal entries already exist for this
     * payment's reference.
     */
    private void reverseClearingEntry(Payment payment) {
        try {
            List<JournalEntry> candidates = journalEntryRepository.findByReferenceAndDeletedFalse(payment.getPaymentNumber());

            List<JournalEntry> clearingEntries = candidates.stream()
                    .filter(je -> (CLEARING_DESC_PREFIX + payment.getPaymentNumber()).equals(je.getDescription()))
                    .sorted(Comparator.comparing(JournalEntry::getCreatedAt))
                    .toList();
            long alreadyReversedCount = candidates.stream()
                    .filter(je -> (CLEARING_REVERSAL_DESC_PREFIX + payment.getPaymentNumber()).equals(je.getDescription()))
                    .count();

            if (alreadyReversedCount >= clearingEntries.size()) {
                return;
            }
            JournalEntry toReverse = clearingEntries.get((int) alreadyReversedCount);

            List<JournalEntryLineDTO> reversedLines = toReverse.getLines().stream()
                    .map(line -> {
                        JournalEntryLineDTO dto = new JournalEntryLineDTO();
                        dto.setAccountId(line.getAccount().getId());
                        dto.setDebit(line.getCredit());
                        dto.setCredit(line.getDebit());
                        dto.setDescription("Unmatch reversal: " + line.getDescription());
                        return dto;
                    })
                    .toList();

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription(CLEARING_REVERSAL_DESC_PREFIX + payment.getPaymentNumber());
            entry.setReference(payment.getPaymentNumber());
            entry.setLines(reversedLines);

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to reverse bank-clearing auto-journal entry for payment {}: {}", payment.getPaymentNumber(), e.getMessage());
        }
    }

    private JournalEntryLineDTO debitLine(UUID accountId, BigDecimal amount, String description) {
        JournalEntryLineDTO line = new JournalEntryLineDTO();
        line.setAccountId(accountId);
        line.setDebit(amount);
        line.setCredit(BigDecimal.ZERO);
        line.setDescription(description);
        return line;
    }

    private JournalEntryLineDTO creditLine(UUID accountId, BigDecimal amount, String description) {
        JournalEntryLineDTO line = new JournalEntryLineDTO();
        line.setAccountId(accountId);
        line.setDebit(BigDecimal.ZERO);
        line.setCredit(amount);
        line.setDescription(description);
        return line;
    }

    @Transactional(readOnly = true)
    public BankSummaryDTO getSummary() {
        long unreconciledCount = bankTransactionRepository.countByReconciledAndDeletedFalse(false);
        long reconciledCount = bankTransactionRepository.countByReconciledAndDeletedFalse(true);
        BigDecimal unreconciledTotal = bankTransactionRepository.sumUnreconciledAmount();
        return new BankSummaryDTO(unreconciledCount, reconciledCount, unreconciledTotal);
    }

    private BankTransaction getTransactionOrThrow(UUID id) {
        return bankTransactionRepository.findById(id)
                .filter(t -> !Boolean.TRUE.equals(t.getDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Bank transaction not found"));
    }

    private BankTransactionDTO toDto(BankTransaction txn) {
        BankTransactionDTO dto = new BankTransactionDTO();
        dto.setId(txn.getId());
        dto.setTxnDate(txn.getTxnDate());
        dto.setDescription(txn.getDescription());
        dto.setAmount(txn.getAmount());
        dto.setReference(txn.getReference());
        dto.setSourceFilename(txn.getSourceFilename());
        dto.setReconciled(txn.getReconciled());
        dto.setImportBatchId(txn.getImportBatchId());
        dto.setCreatedAt(txn.getCreatedAt());
        if (txn.getMatchedPayment() != null) {
            dto.setMatchedPaymentId(txn.getMatchedPayment().getId());
            dto.setMatchedPaymentNumber(txn.getMatchedPayment().getPaymentNumber());
        }
        return dto;
    }
}
