package com.mulaerp.pos.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One product line of a PoS sale. productId/productName/acquisitionCostSnapshot are point-in-
 * time snapshots taken at sale time (not a live join to Product), so the sale's historical
 * record and COGS figure stay correct even if the product is later edited or soft-deleted.
 */
@Entity
@Table(name = "pos_sale_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PosSaleLine extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id", nullable = false)
    private PosSale sale;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "line_discount", nullable = false, precision = 15, scale = 2)
    private BigDecimal lineDiscount = BigDecimal.ZERO;

    @Column(name = "line_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal lineTotal;

    /** Product.acquisitionCost at the moment of sale, used to post COGS - null if not set on the product. */
    @Column(name = "acquisition_cost_snapshot", precision = 15, scale = 2)
    private BigDecimal acquisitionCostSnapshot;
}
