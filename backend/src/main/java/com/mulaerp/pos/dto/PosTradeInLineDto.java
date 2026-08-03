package com.mulaerp.pos.dto;

import com.mulaerp.pos.entity.PosTradeInLine;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PosTradeInLineDto {
    private UUID id;
    private UUID productId;
    private String description;
    private String condition;
    private String accessories;
    private Boolean hasBox;
    private BigDecimal offeredCashValue;
    private BigDecimal offeredCreditValue;
    private BigDecimal payoutAmount;
    /** V38 - see PosTradeInLine. */
    private UUID categoryId;
    private Boolean linkedExistingProduct;

    public static PosTradeInLineDto fromEntity(PosTradeInLine line) {
        PosTradeInLineDto dto = new PosTradeInLineDto();
        dto.setId(line.getId());
        dto.setProductId(line.getProductId());
        dto.setDescription(line.getDescription());
        dto.setCondition(line.getCondition());
        dto.setAccessories(line.getAccessories());
        dto.setHasBox(line.getHasBox());
        dto.setOfferedCashValue(line.getOfferedCashValue());
        dto.setOfferedCreditValue(line.getOfferedCreditValue());
        dto.setPayoutAmount(line.getPayoutAmount());
        dto.setCategoryId(line.getCategoryId());
        dto.setLinkedExistingProduct(line.getLinkedExistingProduct());
        return dto;
    }
}
