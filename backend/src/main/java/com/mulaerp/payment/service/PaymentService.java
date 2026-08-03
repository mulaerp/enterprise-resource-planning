package com.mulaerp.payment.service;

import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.service.AccountingService;
import com.mulaerp.accounting.service.CashAccountResolver;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.email.service.EmailTemplateService;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.invoice.repository.InvoiceRepository;
import com.mulaerp.payment.dto.CreatePaymentRequest;
import com.mulaerp.payment.dto.PaymentDTO;
import com.mulaerp.payment.entity.Payment;
import com.mulaerp.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private static final String ACCOUNTS_RECEIVABLE_CODE = "1120";

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final EmailTemplateService emailTemplateService;
    private final AccountingService accountingService;
    private final AccountRepository accountRepository;
    private final CashAccountResolver cashAccountResolver;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;

    @Value("${mulaerp.mail.admin-recipient:admin@mulaerp.com}")
    private String adminRecipient;

    // NOTE: intentionally not @Cacheable - RedisCacheManager's Jackson serializer (see
    // CacheConfig) cannot deserialize org.springframework.data.domain.PageImpl (no default
    // constructor/Creator), so caching a Page<> here 500s on every read.
    @Transactional(readOnly = true)
    public Page<PaymentDTO> getAllPayments(Pageable pageable) {
        return paymentRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "payment", key = "#id")
    public PaymentDTO getPaymentById(UUID id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
        return convertToDTO(payment);
    }

    @Transactional(readOnly = true)
    public Page<PaymentDTO> searchPayments(String search, Pageable pageable) {
        return paymentRepository.searchPayments(search, pageable).map(this::convertToDTO);
    }

    @Transactional
    @CacheEvict(value = {"payments", "payment", "invoices", "invoice"}, allEntries = true)
    public PaymentDTO createPayment(CreatePaymentRequest request) {
        Invoice invoice = invoiceRepository.findById(request.getInvoiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));

        // Validate payment amount
        BigDecimal balanceDue = invoice.getBalanceDue();
        if (request.getAmount().compareTo(balanceDue) > 0) {
            throw new IllegalArgumentException("Payment amount exceeds balance due");
        }

        Payment payment = new Payment();
        payment.setPaymentNumber(generatePaymentNumber());
        payment.setInvoice(invoice);
        payment.setPaymentDate(request.getPaymentDate());
        payment.setAmount(request.getAmount());
        payment.setMethod(request.getMethod());
        payment.setReference(request.getReference());
        payment.setStatus(Payment.PaymentStatus.COMPLETED);
        payment.setNotes(request.getNotes());

        Payment saved = paymentRepository.save(payment);

        // Update invoice paid amount
        invoice.setPaidAmount(invoice.getPaidAmount().add(request.getAmount()));
        if (invoice.getBalanceDue().compareTo(BigDecimal.ZERO) == 0) {
            invoice.setStatus(Invoice.InvoiceStatus.PAID);
        }
        invoiceRepository.save(invoice);

        // Send payment receipt email once the payment is recorded (WP2)
        sendPaymentReceiptEmail(saved, invoice);

        // Create a draft journal entry (Cash / Accounts Receivable) once the payment is recorded (WP4a)
        createPaymentJournalEntry(saved, invoice);

        return convertToDTO(saved);
    }

    private void sendPaymentReceiptEmail(Payment payment, Invoice invoice) {
        try {
            Customer customer = invoice.getCustomer();
            boolean hasEmail = customer != null && customer.getEmail() != null && !customer.getEmail().isBlank();
            String recipient = hasEmail ? customer.getEmail() : adminRecipient;
            String customerName = customer != null ? customer.getName() : "Customer";

            // CRITICAL FIX 3: REQUIRES_NEW via NonBlockingHookExecutor - a mail-send failure rolls
            // back only this transaction, never payment recording.
            nonBlockingHookExecutor.runInNewTransaction(() -> emailTemplateService.sendPaymentReceipt(
                    recipient,
                    customerName,
                    payment.getPaymentNumber(),
                    payment.getAmount().doubleValue(),
                    payment.getPaymentDate(),
                    payment.getMethod().name()
            ));
        } catch (Exception e) {
            log.warn("Failed to send payment receipt email for payment {}: {}", payment.getPaymentNumber(), e.getMessage());
        }
    }

    /**
     * Auto-journal hook: debit the account resolved from {@code payment.getMethod()} (see
     * CashAccountResolver - CASH -> 1111, CREDIT_CARD/DEBIT_CARD -> 1112, BANK_TRANSFER/CHECK ->
     * 1114, etc., instead of the single legacy 1110 regardless of method), credit Accounts
     * Receivable for the payment amount. Posted as DRAFT so a human reviews and posts it - never
     * blocks payment recording on failure.
     */
    private void createPaymentJournalEntry(Payment payment, Invoice invoice) {
        try {
            if (payment.getAmount() == null || payment.getAmount().compareTo(BigDecimal.ZERO) == 0) {
                return;
            }

            String cashCode = cashAccountResolver.resolveCode(payment.getMethod().name());
            Optional<Account> cash = accountRepository.findByCodeAndDeletedFalse(cashCode);
            Optional<Account> accountsReceivable = accountRepository.findByCodeAndDeletedFalse(ACCOUNTS_RECEIVABLE_CODE);

            if (cash.isEmpty() || accountsReceivable.isEmpty()) {
                log.warn("Skipping auto-journal for payment {}: missing well-known account(s) {}/{}",
                        payment.getPaymentNumber(), cashCode, ACCOUNTS_RECEIVABLE_CODE);
                return;
            }

            JournalEntryLineDTO debitLine = new JournalEntryLineDTO();
            debitLine.setAccountId(cash.get().getId());
            debitLine.setDebit(payment.getAmount());
            debitLine.setCredit(BigDecimal.ZERO);
            debitLine.setDescription(cash.get().getName() + " received - Payment " + payment.getPaymentNumber());

            JournalEntryLineDTO creditLine = new JournalEntryLineDTO();
            creditLine.setAccountId(accountsReceivable.get().getId());
            creditLine.setDebit(BigDecimal.ZERO);
            creditLine.setCredit(payment.getAmount());
            creditLine.setDescription("Accounts Receivable settled - Invoice " + invoice.getInvoiceNumber());

            List<JournalEntryLineDTO> lines = new ArrayList<>();
            lines.add(debitLine);
            lines.add(creditLine);

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(payment.getPaymentDate() != null ? payment.getPaymentDate() : LocalDate.now());
            entry.setDescription("Auto-generated: Payment " + payment.getPaymentNumber()
                    + " for Invoice " + invoice.getInvoiceNumber());
            entry.setReference(payment.getPaymentNumber());
            entry.setLines(lines);

            // CRITICAL FIX 3: REQUIRES_NEW via NonBlockingHookExecutor - see the email hook above.
            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create auto-journal entry for payment {}: {}", payment.getPaymentNumber(), e.getMessage());
        }
    }

    /**
     * FIX: cancelling a COMPLETED payment used to only reverse the invoice's paidAmount/status,
     * leaving the Cash/Accounts-Receivable journal entry {@link #createPaymentJournalEntry} posted
     * behind untouched - so cancelling a payment silently left revenue/cash recognised as if it
     * were still in effect. Now also posts a reversing SYSTEM entry (see
     * {@link #createPaymentCancellationJournalEntry}), the same way {@code PosSaleService#voidSale}
     * reverses a voided sale's journal entries: a new mirror-image entry, never an edit/delete of
     * the original.
     *
     * <p><b>Idempotency:</b> both the invoice reversal and the journal reversal are gated on
     * {@code oldStatus == COMPLETED} - the status read BEFORE this method's own
     * {@code payment.setStatus(status)} call below. Cancelling an already-CANCELLED payment reads
     * {@code oldStatus == CANCELLED}, so this whole block is skipped and nothing is reversed a
     * second time; this makes double-cancellation naturally safe without a separate flag/column.
     */
    @Transactional
    @CacheEvict(value = {"payments", "payment", "invoices", "invoice"}, allEntries = true)
    public PaymentDTO updateStatus(UUID id, Payment.PaymentStatus status) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));

        Payment.PaymentStatus oldStatus = payment.getStatus();
        payment.setStatus(status);

        // If payment is cancelled, reverse the invoice payment and the journal entry it posted.
        if (status == Payment.PaymentStatus.CANCELLED && oldStatus == Payment.PaymentStatus.COMPLETED) {
            Invoice invoice = payment.getInvoice();
            invoice.setPaidAmount(invoice.getPaidAmount().subtract(payment.getAmount()));
            if (invoice.getStatus() == Invoice.InvoiceStatus.PAID) {
                invoice.setStatus(Invoice.InvoiceStatus.SENT);
            }
            invoiceRepository.save(invoice);

            createPaymentCancellationJournalEntry(payment, invoice);
        }

        Payment updated = paymentRepository.save(payment);
        return convertToDTO(updated);
    }

    /**
     * Reverses the Cash/Accounts-Receivable journal entry {@link #createPaymentJournalEntry}
     * posted when this payment was originally recorded - exact mirror image (debit/credit
     * swapped): debit Accounts Receivable to reinstate the receivable, credit the SAME cash/
     * clearing account the original payment debited - derived the same way the original posting
     * did (payment.getMethod() through {@link CashAccountResolver}, never hardcoded), so a CARD
     * payment's cancellation reverses 1112, a BANK_TRANSFER payment's cancellation reverses 1114,
     * etc. Posted as a SYSTEM entry (auto-posts immediately per the same policy as the original -
     * see {@code AccountingService#createSystemEntry}), and never mutates/deletes the original
     * entry - same non-blocking-hook pattern as every other auto-journal call site in this
     * codebase, so a posting failure here can never fail the cancellation itself.
     */
    private void createPaymentCancellationJournalEntry(Payment payment, Invoice invoice) {
        try {
            if (payment.getAmount() == null || payment.getAmount().compareTo(BigDecimal.ZERO) == 0) {
                return;
            }

            String cashCode = cashAccountResolver.resolveCode(payment.getMethod().name());
            Optional<Account> cash = accountRepository.findByCodeAndDeletedFalse(cashCode);
            Optional<Account> accountsReceivable = accountRepository.findByCodeAndDeletedFalse(ACCOUNTS_RECEIVABLE_CODE);

            if (cash.isEmpty() || accountsReceivable.isEmpty()) {
                log.warn("Skipping cancellation-reversal auto-journal for payment {}: missing well-known account(s) {}/{}",
                        payment.getPaymentNumber(), cashCode, ACCOUNTS_RECEIVABLE_CODE);
                return;
            }

            JournalEntryLineDTO debitLine = new JournalEntryLineDTO();
            debitLine.setAccountId(accountsReceivable.get().getId());
            debitLine.setDebit(payment.getAmount());
            debitLine.setCredit(BigDecimal.ZERO);
            debitLine.setDescription("Accounts Receivable reinstated - cancellation of Payment " + payment.getPaymentNumber());

            JournalEntryLineDTO creditLine = new JournalEntryLineDTO();
            creditLine.setAccountId(cash.get().getId());
            creditLine.setDebit(BigDecimal.ZERO);
            creditLine.setCredit(payment.getAmount());
            creditLine.setDescription(cash.get().getName() + " reclaimed - cancellation of Payment " + payment.getPaymentNumber());

            List<JournalEntryLineDTO> lines = new ArrayList<>();
            lines.add(debitLine);
            lines.add(creditLine);

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Cancellation of Payment " + payment.getPaymentNumber()
                    + " for Invoice " + invoice.getInvoiceNumber());
            entry.setReference(payment.getPaymentNumber());
            entry.setLines(lines);

            // CRITICAL FIX 3 pattern: REQUIRES_NEW via NonBlockingHookExecutor - see
            // createPaymentJournalEntry/sendPaymentReceiptEmail above.
            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create cancellation-reversal auto-journal entry for payment {}: {}", payment.getPaymentNumber(), e.getMessage());
        }
    }

    @Transactional
    @CacheEvict(value = {"payments", "payment"}, allEntries = true)
    public void deletePayment(UUID id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));

        if (payment.getStatus() == Payment.PaymentStatus.COMPLETED) {
            throw new IllegalStateException("Cannot delete completed payment");
        }

        paymentRepository.delete(payment);
    }

    // count()-based sequence has no locking, so two concurrent payment creations can read the
    // same count and produce the same number - append a random hex suffix so the number is
    // unique by construction even when that race happens.
    private String generatePaymentNumber() {
        String prefix = "PAY-" + LocalDate.now().getYear() + "-";
        long count = paymentRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }

    private PaymentDTO convertToDTO(Payment payment) {
        PaymentDTO dto = new PaymentDTO();
        dto.setId(payment.getId());
        dto.setPaymentNumber(payment.getPaymentNumber());
        dto.setInvoiceId(payment.getInvoice().getId());
        dto.setInvoiceNumber(payment.getInvoice().getInvoiceNumber());
        dto.setPaymentDate(payment.getPaymentDate());
        dto.setAmount(payment.getAmount());
        dto.setMethod(payment.getMethod());
        dto.setReference(payment.getReference());
        dto.setStatus(payment.getStatus());
        dto.setNotes(payment.getNotes());
        dto.setCreatedAt(payment.getCreatedAt());
        dto.setUpdatedAt(payment.getUpdatedAt());
        return dto;
    }
}
