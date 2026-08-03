package com.mulaerp.shop.quote.dto;

import com.mulaerp.shop.quote.entity.ShopTradeInQuote;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * HONESTY REQUIREMENT (task item 5): {@link #indicative} and {@link #indicativeMessage} are always
 * populated on every response, whatever the status, so a customer can never mistake
 * quotedMin/quotedMax for a firm commitment - and once inspected, {@link #finalOffer} is a
 * distinct pair of fields from the original {@link #quotedMin}/{@link #quotedMax}, never
 * overwriting them, so a customer can see both the original indicative range and the real final
 * offer side by side.
 *
 * <p>{@link #guestEmail}/{@link #guestName}/{@link #guestPhone} are LEGACY ONLY (see {@code
 * ShopTradeInQuote}'s class javadoc "Members-only") - always {@code null} on any quote created
 * after the members-only change; still surfaced here so staff admin views can render pre-existing
 * legacy rows correctly.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShopTradeInQuoteDto {

    private UUID id;
    private String quoteNumber;
    private String status;

    private UUID shopCustomerId;
    private String guestEmail;
    private String guestName;
    private String guestPhone;

    private UUID productId;
    private String productName;
    private String freeTextDescription;
    private UUID categoryId;
    private String categoryName;

    private String declaredCondition;
    private Boolean hasBox;
    private String accessories;
    private String deliveryMethod;

    private BigDecimal quotedMin;
    private BigDecimal quotedMax;
    private LocalDateTime quotedAt;
    private LocalDateTime expiresAt;

    /** Always true - see class javadoc. */
    private boolean indicative = true;
    private String indicativeMessage;

    private BigDecimal finalOffer;
    private String finalPayoutType;
    private Boolean finalOfferOutOfRange;
    private String inspectionNotes;
    private String inspectedBy;
    private LocalDateTime inspectedAt;
    private LocalDateTime decidedAt;

    private UUID posTradeInId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ShopTradeInQuoteDto fromEntity(ShopTradeInQuote q, String productName, String categoryName) {
        ShopTradeInQuoteDto dto = new ShopTradeInQuoteDto();
        dto.setId(q.getId());
        dto.setQuoteNumber(q.getQuoteNumber());
        dto.setStatus(q.getStatus());
        dto.setShopCustomerId(q.getShopCustomerId());
        dto.setGuestEmail(q.getGuestEmail());
        dto.setGuestName(q.getGuestName());
        dto.setGuestPhone(q.getGuestPhone());
        dto.setProductId(q.getProductId());
        dto.setProductName(productName);
        dto.setFreeTextDescription(q.getFreeTextDescription());
        dto.setCategoryId(q.getCategoryId());
        dto.setCategoryName(categoryName);
        dto.setDeclaredCondition(q.getDeclaredCondition());
        dto.setHasBox(q.getHasBox());
        dto.setAccessories(q.getAccessories());
        dto.setDeliveryMethod(q.getDeliveryMethod());
        dto.setQuotedMin(q.getQuotedMin());
        dto.setQuotedMax(q.getQuotedMax());
        dto.setQuotedAt(q.getQuotedAt());
        dto.setExpiresAt(q.getExpiresAt());
        dto.setIndicative(true);
        dto.setIndicativeMessage("This is an indicative range only (RM " + q.getQuotedMin() + " - RM " + q.getQuotedMax()
                + "), valid until " + q.getExpiresAt() + ", and is subject to physical inspection on arrival - "
                + "the final offer may differ.");
        dto.setFinalOffer(q.getFinalOffer());
        dto.setFinalPayoutType(q.getFinalPayoutType());
        dto.setFinalOfferOutOfRange(q.getFinalOfferOutOfRange());
        dto.setInspectionNotes(q.getInspectionNotes());
        dto.setInspectedBy(q.getInspectedBy());
        dto.setInspectedAt(q.getInspectedAt());
        dto.setDecidedAt(q.getDecidedAt());
        dto.setPosTradeInId(q.getPosTradeInId());
        dto.setCreatedAt(q.getCreatedAt());
        dto.setUpdatedAt(q.getUpdatedAt());
        return dto;
    }
}
