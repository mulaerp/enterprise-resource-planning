package com.mulaerp.sales.dto;

import com.mulaerp.sales.entity.SalesOrderItem;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SalesOrderItemDto {
    private String id;
    private String productId;
    private String productName;
    private String productSku;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal discount;
    private BigDecimal taxRate;
    private BigDecimal total;

    public static SalesOrderItemDto fromEntity(SalesOrderItem item) {
        SalesOrderItemDto dto = new SalesOrderItemDto();
        dto.setId(item.getId().toString());
        dto.setProductId(item.getProduct().getId().toString());
        dto.setProductName(item.getProduct().getName());
        dto.setProductSku(item.getProduct().getSku());
        dto.setQuantity(item.getQuantity());
        dto.setUnitPrice(item.getUnitPrice());
        dto.setDiscount(item.getDiscount());
        dto.setTaxRate(item.getTaxRate());
        dto.setTotal(item.getTotal());
        return dto;
    }
}
