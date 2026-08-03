package com.mulaerp.sales.entity;

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
@Table(name = "sales_order_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class SalesOrderItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private SalesOrder salesOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "discount", precision = 15, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "tax_rate", precision = 5, scale = 2)
    private BigDecimal taxRate = BigDecimal.ZERO;

    @Column(name = "total", precision = 15, scale = 2, nullable = false)
    private BigDecimal total = BigDecimal.ZERO;

    // --- WP3: optional batch/serial tracking (V19) ------------------------------------------
    // Both nullable - existing sales orders/items without any tracking selection are unaffected.

    /** Batch this line will be fulfilled from; validated + decremented on delivery. */
    @Column(name = "batch_id")
    private UUID batchId;

    /** Comma-separated ProductSerial ids sold on this line; see inventory.util.UuidCsv. */
    @Column(name = "serial_ids", columnDefinition = "TEXT")
    private String serialIds;

    public void calculateTotal() {
        BigDecimal itemTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
        itemTotal = itemTotal.subtract(discount);
        this.total = itemTotal;
    }
}
