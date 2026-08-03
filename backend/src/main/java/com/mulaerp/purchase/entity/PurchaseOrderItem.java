package com.mulaerp.purchase.entity;

import com.mulaerp.common.entity.BaseEntity;
import com.mulaerp.product.entity.Product;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "purchase_order_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class PurchaseOrderItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "po_id", nullable = false)
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "received_quantity")
    private Integer receivedQuantity = 0;

    // --- WP3: optional batch/serial tracking (V19) ------------------------------------------
    // Both nullable, populated only when the receiver supplies tracking info on receipt.

    /** Batch created/attached for the received quantity, if a batch number was supplied. */
    @Column(name = "batch_id")
    private UUID batchId;

    /** Comma-separated ProductSerial ids registered on receipt; see inventory.util.UuidCsv. */
    @Column(name = "serial_ids", columnDefinition = "TEXT")
    private String serialIds;

    public void calculateTotal() {
        BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
        BigDecimal taxAmount = itemTotal.multiply(taxRate).divide(BigDecimal.valueOf(100));
        this.total = itemTotal.add(taxAmount);
    }
}
