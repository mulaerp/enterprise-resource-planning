package com.mulaerp.invoice.service;

import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.service.AccountingService;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.email.service.EmailTemplateService;
import com.mulaerp.invoice.dto.CreateInvoiceRequest;
import com.mulaerp.invoice.dto.InvoiceDTO;
import com.mulaerp.invoice.dto.InvoiceItemDTO;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.invoice.entity.InvoiceItem;
import com.mulaerp.invoice.repository.InvoiceRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceService {

    private static final String ACCOUNTS_RECEIVABLE_CODE = "1120";
    private static final String SALES_REVENUE_CODE = "4100";

    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final EmailTemplateService emailTemplateService;
    private final AccountingService accountingService;
    private final AccountRepository accountRepository;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;

    @Value("${mulaerp.mail.admin-recipient:admin@mulaerp.com}")
    private String adminRecipient;

    // NOTE: intentionally not @Cacheable - RedisCacheManager's Jackson serializer (see
    // CacheConfig) cannot deserialize org.springframework.data.domain.PageImpl (no default
    // constructor/Creator), so caching a Page<> here 500s on every read.
    @Transactional(readOnly = true)
    public Page<InvoiceDTO> getAllInvoices(Pageable pageable) {
        return invoiceRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "invoice", key = "#id")
    public InvoiceDTO getInvoiceById(UUID id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));
        return convertToDTO(invoice);
    }

    @Transactional(readOnly = true)
    public Page<InvoiceDTO> searchInvoices(String search, Pageable pageable) {
        return invoiceRepository.searchInvoices(search, pageable).map(this::convertToDTO);
    }

    @Transactional
    @CacheEvict(value = {"invoices", "invoice"}, allEntries = true)
    public InvoiceDTO createInvoice(CreateInvoiceRequest request) {
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(generateInvoiceNumber());
        invoice.setCustomer(customer);
        invoice.setInvoiceDate(request.getInvoiceDate());
        invoice.setDueDate(request.getDueDate());
        invoice.setStatus(Invoice.InvoiceStatus.DRAFT);
        invoice.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        invoice.setNotes(request.getNotes());

        for (CreateInvoiceRequest.InvoiceItemRequest itemReq : request.getItems()) {
            InvoiceItem item = new InvoiceItem();
            
            if (itemReq.getProductId() != null) {
                Product product = productRepository.findById(itemReq.getProductId())
                        .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
                item.setProduct(product);
            }
            
            item.setDescription(itemReq.getDescription());
            item.setQuantity(itemReq.getQuantity());
            item.setUnitPrice(itemReq.getUnitPrice());
            item.setTaxRate(itemReq.getTaxRate() != null ? itemReq.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();

            invoice.addItem(item);
        }

        invoice.calculateTotals();
        Invoice saved = invoiceRepository.save(invoice);

        // Send invoice notification email once the invoice is created (WP2)
        sendInvoiceNotificationEmail(saved);

        // Create a draft journal entry (AR / Sales Revenue) once the invoice is created (WP4a)
        createInvoiceJournalEntry(saved);

        return convertToDTO(saved);
    }

    private void sendInvoiceNotificationEmail(Invoice invoice) {
        try {
            Customer customer = invoice.getCustomer();
            boolean hasEmail = customer != null && customer.getEmail() != null && !customer.getEmail().isBlank();
            String recipient = hasEmail ? customer.getEmail() : adminRecipient;
            String customerName = customer != null ? customer.getName() : "Customer";

            // CRITICAL FIX 3: REQUIRES_NEW via NonBlockingHookExecutor - a mail-send failure rolls
            // back only this (empty, no-op-for-mail) transaction, never invoice creation.
            nonBlockingHookExecutor.runInNewTransaction(() -> emailTemplateService.sendInvoiceNotification(
                    recipient,
                    customerName,
                    invoice.getInvoiceNumber(),
                    invoice.getTotal().doubleValue(),
                    invoice.getDueDate()
            ));
        } catch (Exception e) {
            log.warn("Failed to send invoice notification email for invoice {}: {}", invoice.getInvoiceNumber(), e.getMessage());
        }
    }

    /**
     * Auto-journal hook: debit Accounts Receivable, credit Sales Revenue for the invoice total.
     * Posted as DRAFT so a human reviews and posts it - never blocks invoice creation on failure.
     */
    private void createInvoiceJournalEntry(Invoice invoice) {
        try {
            if (invoice.getTotal() == null || invoice.getTotal().compareTo(BigDecimal.ZERO) == 0) {
                return;
            }

            Optional<Account> accountsReceivable = accountRepository.findByCodeAndDeletedFalse(ACCOUNTS_RECEIVABLE_CODE);
            Optional<Account> salesRevenue = accountRepository.findByCodeAndDeletedFalse(SALES_REVENUE_CODE);

            if (accountsReceivable.isEmpty() || salesRevenue.isEmpty()) {
                log.warn("Skipping auto-journal for invoice {}: missing well-known account(s) {}/{}",
                        invoice.getInvoiceNumber(), ACCOUNTS_RECEIVABLE_CODE, SALES_REVENUE_CODE);
                return;
            }

            JournalEntryLineDTO debitLine = new JournalEntryLineDTO();
            debitLine.setAccountId(accountsReceivable.get().getId());
            debitLine.setDebit(invoice.getTotal());
            debitLine.setCredit(BigDecimal.ZERO);
            debitLine.setDescription("Accounts Receivable - Invoice " + invoice.getInvoiceNumber());

            JournalEntryLineDTO creditLine = new JournalEntryLineDTO();
            creditLine.setAccountId(salesRevenue.get().getId());
            creditLine.setDebit(BigDecimal.ZERO);
            creditLine.setCredit(invoice.getTotal());
            creditLine.setDescription("Sales Revenue - Invoice " + invoice.getInvoiceNumber());

            List<JournalEntryLineDTO> lines = new ArrayList<>();
            lines.add(debitLine);
            lines.add(creditLine);

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(invoice.getInvoiceDate() != null ? invoice.getInvoiceDate() : LocalDate.now());
            entry.setDescription("Auto-generated: Invoice " + invoice.getInvoiceNumber());
            entry.setReference(invoice.getInvoiceNumber());
            entry.setLines(lines);

            // CRITICAL FIX 3: REQUIRES_NEW via NonBlockingHookExecutor - see the email hook above.
            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create auto-journal entry for invoice {}: {}", invoice.getInvoiceNumber(), e.getMessage());
        }
    }

    @Transactional
    @CacheEvict(value = {"invoices", "invoice"}, allEntries = true)
    public InvoiceDTO updateInvoice(UUID id, CreateInvoiceRequest request) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));

        if (invoice.getStatus() != Invoice.InvoiceStatus.DRAFT) {
            throw new IllegalStateException("Can only update draft invoices");
        }

        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        invoice.setCustomer(customer);
        invoice.setInvoiceDate(request.getInvoiceDate());
        invoice.setDueDate(request.getDueDate());
        invoice.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        invoice.setNotes(request.getNotes());

        invoice.getItems().clear();

        for (CreateInvoiceRequest.InvoiceItemRequest itemReq : request.getItems()) {
            InvoiceItem item = new InvoiceItem();
            
            if (itemReq.getProductId() != null) {
                Product product = productRepository.findById(itemReq.getProductId())
                        .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
                item.setProduct(product);
            }
            
            item.setDescription(itemReq.getDescription());
            item.setQuantity(itemReq.getQuantity());
            item.setUnitPrice(itemReq.getUnitPrice());
            item.setTaxRate(itemReq.getTaxRate() != null ? itemReq.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();

            invoice.addItem(item);
        }

        invoice.calculateTotals();
        Invoice updated = invoiceRepository.save(invoice);
        return convertToDTO(updated);
    }

    @Transactional
    @CacheEvict(value = {"invoices", "invoice"}, allEntries = true)
    public InvoiceDTO updateStatus(UUID id, Invoice.InvoiceStatus status) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));

        invoice.setStatus(status);
        Invoice updated = invoiceRepository.save(invoice);
        return convertToDTO(updated);
    }

    @Transactional
    @CacheEvict(value = {"invoices", "invoice"}, allEntries = true)
    public void deleteInvoice(UUID id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found"));

        if (invoice.getStatus() != Invoice.InvoiceStatus.DRAFT) {
            throw new IllegalStateException("Can only delete draft invoices");
        }

        invoiceRepository.delete(invoice);
    }

    // count()-based sequence has no locking, so two concurrent invoice creations can read the
    // same count and produce the same number - append a random hex suffix so the number is
    // unique by construction even when that race happens.
    private String generateInvoiceNumber() {
        String prefix = "INV-" + LocalDate.now().getYear() + "-";
        long count = invoiceRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }

    private InvoiceDTO convertToDTO(Invoice invoice) {
        InvoiceDTO dto = new InvoiceDTO();
        dto.setId(invoice.getId());
        dto.setInvoiceNumber(invoice.getInvoiceNumber());
        dto.setCustomerId(invoice.getCustomer().getId());
        dto.setCustomerName(invoice.getCustomer().getName());
        dto.setInvoiceDate(invoice.getInvoiceDate());
        dto.setDueDate(invoice.getDueDate());
        dto.setStatus(invoice.getStatus());
        dto.setSubtotal(invoice.getSubtotal());
        dto.setTax(invoice.getTax());
        dto.setTotal(invoice.getTotal());
        dto.setPaidAmount(invoice.getPaidAmount());
        dto.setBalanceDue(invoice.getBalanceDue());
        dto.setNotes(invoice.getNotes());
        dto.setCreatedAt(invoice.getCreatedAt());
        dto.setUpdatedAt(invoice.getUpdatedAt());

        dto.setItems(invoice.getItems().stream().map(item -> {
            InvoiceItemDTO itemDTO = new InvoiceItemDTO();
            itemDTO.setId(item.getId());
            if (item.getProduct() != null) {
                itemDTO.setProductId(item.getProduct().getId());
                itemDTO.setProductName(item.getProduct().getName());
            }
            itemDTO.setDescription(item.getDescription());
            itemDTO.setQuantity(item.getQuantity());
            itemDTO.setUnitPrice(item.getUnitPrice());
            itemDTO.setTaxRate(item.getTaxRate());
            itemDTO.setTotal(item.getTotal());
            return itemDTO;
        }).collect(Collectors.toList()));

        return dto;
    }
}
