package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.StockTakeLine;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockTakeLineDTO {
    private UUID id;
    private UUID sessionId;
    private UUID productId;
    private String productSku;
    private String productName;
    private Integer expectedQuantity;
    private Integer countedQuantity;
    private Integer variance;
    private String note;

    public static StockTakeLineDTO fromEntity(StockTakeLine line) {
        StockTakeLineDTO dto = new StockTakeLineDTO();
        dto.setId(line.getId());
        dto.setSessionId(line.getSession().getId());
        dto.setProductId(line.getProduct().getId());
        dto.setProductSku(line.getProduct().getSku());
        dto.setProductName(line.getProduct().getName());
        dto.setExpectedQuantity(line.getExpectedQuantity());
        dto.setCountedQuantity(line.getCountedQuantity());
        dto.setVariance(line.getVariance());
        dto.setNote(line.getNote());
        return dto;
    }
}
