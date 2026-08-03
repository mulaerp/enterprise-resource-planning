package com.mulaerp.pos.dto;

import com.mulaerp.pos.entity.PosTradeIn;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PosTradeInDto {
    private UUID id;
    private String tradeInNumber;
    private String clientTradeInId;
    private UUID memberId;
    private UUID posSaleId;
    private String payoutType;
    private BigDecimal payoutTotal;
    /** ACTIVE or VOIDED (V36) - see PosSaleService#voidSale. */
    private String status;
    private LocalDateTime voidedAt;
    private List<PosTradeInLineDto> lines;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;

    public static PosTradeInDto fromEntity(PosTradeIn tradeIn) {
        PosTradeInDto dto = new PosTradeInDto();
        dto.setId(tradeIn.getId());
        dto.setTradeInNumber(tradeIn.getTradeInNumber());
        dto.setClientTradeInId(tradeIn.getClientTradeInId());
        dto.setMemberId(tradeIn.getMemberId());
        dto.setPosSaleId(tradeIn.getPosSaleId());
        dto.setPayoutType(tradeIn.getPayoutType());
        dto.setPayoutTotal(tradeIn.getPayoutTotal());
        dto.setStatus(tradeIn.getStatus());
        dto.setVoidedAt(tradeIn.getVoidedAt());
        dto.setCreatedAt(tradeIn.getCreatedAt());
        dto.setUpdatedAt(tradeIn.getUpdatedAt());
        dto.setCreatedBy(tradeIn.getCreatedBy());
        dto.setLines(tradeIn.getLines().stream().map(PosTradeInLineDto::fromEntity).collect(Collectors.toList()));
        return dto;
    }
}
