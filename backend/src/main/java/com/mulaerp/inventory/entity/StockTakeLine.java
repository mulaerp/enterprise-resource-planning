package com.mulaerp.inventory.entity;

import com.mulaerp.common.entity.BaseEntity;
import com.mulaerp.product.entity.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * One product's count line within a {@link StockTakeSession}. {@code expectedQuantity} is
 * snapshotted from {@code warehouse_stock} at session-open time and never recomputed afterwards
 * (see StockTakeService#open) so it stays a faithful record of what the system believed at the
 * moment the count started. {@code countedQuantity}/{@code variance} are null until staff record
 * a count for this line (StockTakeService#recordCount).
 */
@Entity
@Table(name = "stock_take_lines")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class StockTakeLine extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private StockTakeSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "expected_quantity", nullable = false)
    private Integer expectedQuantity;

    @Column(name = "counted_quantity")
    private Integer countedQuantity;

    @Column
    private Integer variance;

    @Column(columnDefinition = "TEXT")
    private String note;
}
