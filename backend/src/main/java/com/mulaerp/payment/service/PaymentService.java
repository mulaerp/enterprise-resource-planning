package com.mulaerp.payment.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.invoice.repository.InvoiceRepository;
import com.mulaerp.payment.dto.CreatePaymentRequest;
import com.mulaerp.payment.dto.PaymentDTO;
import com.mulaerp.payment.entity.Payment;
import com.mulaerp.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    @Cacheable(value = "payments", key = "#pageable.pageNumber + '-' + #pageable.pageSize")
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

        return convertToDTO(saved);
    }

    @Transactional
    @CacheEvict(value = {"payments", "payment", "invoices", "invoice"}, allEntries = true)
    public PaymentDTO updateStatus(UUID id, Payment.PaymentStatus status) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));

        Payment.PaymentStatus oldStatus = payment.getStatus();
        payment.setStatus(status);

        // If payment is cancelled, reverse the invoice payment
        if (status == Payment.PaymentStatus.CANCELLED && oldStatus == Payment.PaymentStatus.COMPLETED) {
            Invoice invoice = payment.getInvoice();
            invoice.setPaidAmount(invoice.getPaidAmount().subtract(payment.getAmount()));
            if (invoice.getStatus() == Invoice.InvoiceStatus.PAID) {
                invoice.setStatus(Invoice.InvoiceStatus.SENT);
            }
            invoiceRepository.save(invoice);
        }

        Payment updated = paymentRepository.save(payment);
        return convertToDTO(updated);
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

    private String generatePaymentNumber() {
        String prefix = "PAY-" + LocalDate.now().getYear() + "-";
        long count = paymentRepository.count() + 1;
        return prefix + String.format("%06d", count);
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
