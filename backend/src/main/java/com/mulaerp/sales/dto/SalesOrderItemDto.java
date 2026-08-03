package com.mulaerp.sales.dto;

import com.mulaerp.inventory.util.UuidCsv;
import com.mulaerp.sales.entity.SalesOrderItem;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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

    // WP3: optional batch/serial tracking - null/empty when the line has none.
    private String batchId;
    private List<String> serialIds;

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
        dto.setBatchId(item.getBatchId() != null ? item.getBatchId().toString() : null);
        dto.setSerialIds(UuidCsv.fromCsv(item.getSerialIds()).stream()
                .map(UUID::toString)
                .collect(Collectors.toList()));
        return dto;
    }
}
