package com.mulaerp.warehouse.dto;

import com.mulaerp.warehouse.entity.WarehouseStock;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WarehouseStockDTO {
    private UUID id;
    private UUID warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private UUID productId;
    private String productName;
    private String productSku;
    private Integer quantity;
    private Integer reservedQuantity;
    private Integer availableQuantity;
    private Integer reorderLevel;
    private LocalDateTime updatedAt;

    public static WarehouseStockDTO fromEntity(WarehouseStock stock) {
        WarehouseStockDTO dto = new WarehouseStockDTO();
        dto.setId(stock.getId());
        dto.setWarehouseId(stock.getWarehouse().getId());
        dto.setWarehouseCode(stock.getWarehouse().getCode());
        dto.setWarehouseName(stock.getWarehouse().getName());
        dto.setProductId(stock.getProduct().getId());
        dto.setProductName(stock.getProduct().getName());
        dto.setProductSku(stock.getProduct().getSku());
        dto.setQuantity(stock.getQuantity());
        dto.setReservedQuantity(stock.getReservedQuantity());
        dto.setAvailableQuantity(stock.getAvailableQuantity());
        dto.setReorderLevel(stock.getReorderLevel());
        dto.setUpdatedAt(stock.getUpdatedAt());
        return dto;
    }
}
