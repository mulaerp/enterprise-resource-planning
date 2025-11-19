package com.mulaerp.invoice.dto;

import com.mulaerp.invoice.entity.Invoice;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceDTO {
    private UUID id;
    private String invoiceNumber;
    private UUID customerId;
    private String customerName;
    private LocalDate invoiceDate;
    private LocalDate dueDate;
    private Invoice.InvoiceStatus status;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal total;
    private BigDecimal paidAmount;
    private BigDecimal balanceDue;
    private String notes;
    private List<InvoiceItemDTO> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
