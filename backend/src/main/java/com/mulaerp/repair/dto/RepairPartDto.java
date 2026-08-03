package com.mulaerp.repair.dto;

import com.mulaerp.repair.entity.RepairPart;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepairPartDto {
    private UUID id;
    private UUID repairJobId;
    private UUID productId;
    private String productName;
    private Integer quantity;
    private BigDecimal unitCost;
    private BigDecimal lineTotal;
    private LocalDateTime createdAt;

    public static RepairPartDto fromEntity(RepairPart part) {
        RepairPartDto dto = new RepairPartDto();
        dto.setId(part.getId());
        dto.setRepairJobId(part.getRepairJobId());
        dto.setProductId(part.getProductId());
        dto.setProductName(part.getProductName());
        dto.setQuantity(part.getQuantity());
        dto.setUnitCost(part.getUnitCost());
        dto.setLineTotal(part.getUnitCost().multiply(BigDecimal.valueOf(part.getQuantity())));
        dto.setCreatedAt(part.getCreatedAt());
        return dto;
    }
}
