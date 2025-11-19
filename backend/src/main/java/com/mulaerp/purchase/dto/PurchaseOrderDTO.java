package com.mulaerp.purchase.dto;

import com.mulaerp.purchase.entity.PurchaseOrder;
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
public class PurchaseOrderDTO {
    private UUID id;
    private String poNumber;
    private UUID supplierId;
    private String supplierName;
    private LocalDate orderDate;
    private LocalDate expectedDate;
    private PurchaseOrder.PurchaseOrderStatus status;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal total;
    private String notes;
    private List<PurchaseOrderItemDTO> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
