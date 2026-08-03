package com.mulaerp.purchase.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseOrderItemDTO {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal taxRate;
    private BigDecimal total;
    private Integer receivedQuantity;

    // WP3: optional batch/serial tracking, populated when supplied on receipt.
    private UUID batchId;
    private List<UUID> serialIds;
}
