package com.mulaerp.shop.order.dto;

import com.mulaerp.shop.order.entity.ShopOrder;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** Shape returned for own/guest/staff order reads - never exposes another customer's identity
 * beyond what the requester already supplied (own order, or guest orderNumber+email match). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShopOrderDto {
    private UUID id;
    private String orderNumber;
    private UUID shopCustomerId;
    private String guestEmail;
    private String guestName;
    private String guestPhone;
    private String fulfilmentType;
    private String deliveryAddress;
    private String status;
    private String paymentMethod;
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private BigDecimal total;
    private LocalDateTime reservedUntil;
    private LocalDateTime fulfilledAt;
    private BigDecimal storeCreditRedeemed;
    private Integer pointsEarned;
    private LocalDateTime voidedAt;
    private String voidedBy;
    private String voidReason;
    private String notes;
    private LocalDateTime createdAt;
    private List<ShopOrderLineDto> lines;
    /** V42 (WEBSHOP Gap B): warranty numbers auto-issued at fulfilment for this order's lines -
     * empty until FULFILLED, or if no line's product carries warrantyMonths. Not filtered by
     * warranty status, so a VOIDed warranty (see #voidOrder) still shows here, just findable via
     * the public checker as VOID rather than ACTIVE. Populated by ShopOrderService (a plain
     * fromEntity call never touches the database), never null. */
    private List<String> warrantyNumbers = new ArrayList<>();

    public static ShopOrderDto fromEntity(ShopOrder order) {
        ShopOrderDto dto = new ShopOrderDto();
        dto.setId(order.getId());
        dto.setOrderNumber(order.getOrderNumber());
        dto.setShopCustomerId(order.getShopCustomerId());
        dto.setGuestEmail(order.getGuestEmail());
        dto.setGuestName(order.getGuestName());
        dto.setGuestPhone(order.getGuestPhone());
        dto.setFulfilmentType(order.getFulfilmentType().name());
        dto.setDeliveryAddress(order.getDeliveryAddress());
        dto.setStatus(order.getStatus().name());
        dto.setPaymentMethod(order.getPaymentMethod().name());
        dto.setSubtotal(order.getSubtotal());
        dto.setDeliveryFee(order.getDeliveryFee());
        dto.setTotal(order.getTotal());
        dto.setReservedUntil(order.getReservedUntil());
        dto.setFulfilledAt(order.getFulfilledAt());
        dto.setStoreCreditRedeemed(order.getStoreCreditRedeemed());
        dto.setPointsEarned(order.getPointsEarned());
        dto.setVoidedAt(order.getVoidedAt());
        dto.setVoidedBy(order.getVoidedBy());
        dto.setVoidReason(order.getVoidReason());
        dto.setNotes(order.getNotes());
        dto.setCreatedAt(order.getCreatedAt());
        dto.setLines(order.getLines().stream().map(ShopOrderLineDto::fromEntity).collect(Collectors.toList()));
        return dto;
    }
}
