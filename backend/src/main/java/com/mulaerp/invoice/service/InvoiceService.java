package com.mulaerp.invoice.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.invoice.dto.CreateInvoiceRequest;
import com.mulaerp.invoice.dto.InvoiceDTO;
import com.mulaerp.invoice.dto.InvoiceItemDTO;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.invoice.entity.InvoiceItem;
import com.mulaerp.invoice.repository.InvoiceRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    @Cacheable(value = "invoices", key = "#pageable.pageNumber + '-' + #pageable.pageSize")
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
        return convertToDTO(saved);
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

    private String generateInvoiceNumber() {
        String prefix = "INV-" + LocalDate.now().getYear() + "-";
        long count = invoiceRepository.count() + 1;
        return prefix + String.format("%06d", count);
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
