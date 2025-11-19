package com.mulaerp.invoice.controller;

import com.mulaerp.invoice.dto.CreateInvoiceRequest;
import com.mulaerp.invoice.dto.InvoiceDTO;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.invoice.service.InvoiceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
@Tag(name = "Invoices", description = "Invoice management endpoints")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @GetMapping
    @Operation(summary = "Get all invoices")
    public ResponseEntity<Page<InvoiceDTO>> getAllInvoices(Pageable pageable) {
        return ResponseEntity.ok(invoiceService.getAllInvoices(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get invoice by ID")
    public ResponseEntity<InvoiceDTO> getInvoiceById(@PathVariable UUID id) {
        return ResponseEntity.ok(invoiceService.getInvoiceById(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search invoices")
    public ResponseEntity<Page<InvoiceDTO>> searchInvoices(
            @RequestParam String query,
            Pageable pageable) {
        return ResponseEntity.ok(invoiceService.searchInvoices(query, pageable));
    }

    @PostMapping
    @Operation(summary = "Create invoice")
    public ResponseEntity<InvoiceDTO> createInvoice(
            @Valid @RequestBody CreateInvoiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(invoiceService.createInvoice(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update invoice")
    public ResponseEntity<InvoiceDTO> updateInvoice(
            @PathVariable UUID id,
            @Valid @RequestBody CreateInvoiceRequest request) {
        return ResponseEntity.ok(invoiceService.updateInvoice(id, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update invoice status")
    public ResponseEntity<InvoiceDTO> updateStatus(
            @PathVariable UUID id,
            @RequestParam Invoice.InvoiceStatus status) {
        return ResponseEntity.ok(invoiceService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete invoice")
    public ResponseEntity<Void> deleteInvoice(@PathVariable UUID id) {
        invoiceService.deleteInvoice(id);
        return ResponseEntity.noContent().build();
    }
}
