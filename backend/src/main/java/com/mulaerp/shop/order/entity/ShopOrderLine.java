package com.mulaerp.shop.order.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * One product line of a {@link ShopOrder}. {@code productId}/{@code productName}/{@code sku}/
 * {@code unitPrice}/{@code acquisitionCostSnapshot} are point-in-time snapshots taken at order
 * placement - same rationale as {@code PosSaleLine}: a product's name/price/cost can change after
 * the order is placed, but the order must keep showing what the customer actually agreed to (and
 * fulfilment's COGS posting must use the cost that applied when the unit was reserved, not
 * whatever the product record says later).
 */
@Entity
@Table(name = "shop_order_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ShopOrderLine extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "order_id", nullable = false)
    private ShopOrder order;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false, length = 100)
    private String sku;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "line_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal lineTotal;

    /** Null when the product had no acquisitionCost set at placement time - see the pos skill's
     * "needs acquisitionCost, not costPrice" caveat, which applies identically here. */
    @Column(name = "acquisition_cost_snapshot", precision = 15, scale = 2)
    private BigDecimal acquisitionCostSnapshot;
}
