package com.mulaerp.shop.order.dto;

import com.mulaerp.shop.order.entity.ShopOrderLine;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShopOrderLineDto {
    private UUID id;
    private UUID productId;
    private String productName;
    private String sku;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;

    public static ShopOrderLineDto fromEntity(ShopOrderLine line) {
        return new ShopOrderLineDto(
                line.getId(),
                line.getProductId(),
                line.getProductName(),
                line.getSku(),
                line.getQuantity(),
                line.getUnitPrice(),
                line.getLineTotal()
        );
    }
}
