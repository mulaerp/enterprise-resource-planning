package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.StockAdjustment;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockAdjustmentDTO {
    private UUID id;
    private String adjustmentNumber;
    private UUID productId;
    private String productName;
    private UUID warehouseId;
    private StockAdjustment.AdjustmentType adjustmentType;
    private Integer quantityBefore;
    private Integer quantityAdjusted;
    private Integer quantityAfter;
    private String reason;
    private String notes;
    private LocalDate adjustmentDate;
    private String approvedBy;

    public static StockAdjustmentDTO fromEntity(StockAdjustment adjustment) {
        StockAdjustmentDTO dto = new StockAdjustmentDTO();
        dto.setId(adjustment.getId());
        dto.setAdjustmentNumber(adjustment.getAdjustmentNumber());
        dto.setProductId(adjustment.getProduct().getId());
        dto.setProductName(adjustment.getProduct().getName());
        dto.setWarehouseId(adjustment.getWarehouseId());
        dto.setAdjustmentType(adjustment.getAdjustmentType());
        dto.setQuantityBefore(adjustment.getQuantityBefore());
        dto.setQuantityAdjusted(adjustment.getQuantityAdjusted());
        dto.setQuantityAfter(adjustment.getQuantityAfter());
        dto.setReason(adjustment.getReason());
        dto.setNotes(adjustment.getNotes());
        dto.setAdjustmentDate(adjustment.getAdjustmentDate());
        dto.setApprovedBy(adjustment.getApprovedBy());
        return dto;
    }
}
