package com.mulaerp.purchase.entity;

import com.mulaerp.common.entity.BaseEntity;
import com.mulaerp.product.entity.Product;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

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

    public void calculateTotal() {
        BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
        BigDecimal taxAmount = itemTotal.multiply(taxRate).divide(BigDecimal.valueOf(100));
        this.total = itemTotal.add(taxAmount);
    }
}
