package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.StockMovement;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockMovementDTO {
    private UUID id;
    private UUID productId;
    private String productSku;
    private String productName;
    private UUID warehouseId;
    private StockMovement.MovementType movementType;
    private Integer quantityDelta;
    private Integer quantityAfter;
    private String reference;
    private String notes;
    private LocalDateTime createdAt;
    private String createdBy;

    public static StockMovementDTO fromEntity(StockMovement movement) {
        return StockMovementDTO.builder()
                .id(movement.getId())
                .productId(movement.getProduct().getId())
                .productSku(movement.getProduct().getSku())
                .productName(movement.getProduct().getName())
                .warehouseId(movement.getWarehouseId())
                .movementType(movement.getMovementType())
                .quantityDelta(movement.getQuantityDelta())
                .quantityAfter(movement.getQuantityAfter())
                .reference(movement.getReference())
                .notes(movement.getNotes())
                .createdAt(movement.getCreatedAt())
                .createdBy(movement.getCreatedBy())
                .build();
    }
}
