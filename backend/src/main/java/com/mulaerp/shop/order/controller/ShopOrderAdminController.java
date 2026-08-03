package com.mulaerp.shop.order.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.shop.order.dto.FulfilOrderRequest;
import com.mulaerp.shop.order.dto.ShopOrderDto;
import com.mulaerp.shop.order.dto.VoidShopOrderRequest;
import com.mulaerp.shop.order.dto.VoidShopOrderResponseDto;
import com.mulaerp.shop.order.entity.ShopOrder;
import com.mulaerp.shop.order.service.ShopOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Staff-side online order management ({@code /api/v1/shop/admin/orders/**}). Lives under
 * {@code /api/v1/shop/**} but is carved out of the blanket {@code hasRole('SHOP_CUSTOMER')}
 * matcher in {@code SecurityConfig} (matched first, {@code authenticated()} only) - a staff
 * MULAERP_AUTH cookie/Bearer token authenticates here via the ordinary {@code
 * JwtAuthenticationFilter}, same as every other staff endpoint; method-level
 * {@code @PreAuthorize} below is what actually gates each action (see {@link RoleRules#SHOP_ORDER_STAFF}
 * for the cashier-inclusive rationale).
 */
@RestController
@RequestMapping("/api/v1/shop/admin/orders")
@RequiredArgsConstructor
public class ShopOrderAdminController {

    private final ShopOrderService shopOrderService;

    @GetMapping
    @PreAuthorize(RoleRules.SHOP_ORDER_STAFF)
    public Page<ShopOrderDto> list(
            @RequestParam(required = false) ShopOrder.OrderStatus status,
            @RequestParam(required = false) ShopOrder.FulfilmentType fulfilmentType,
            Pageable pageable) {
        return shopOrderService.adminList(status, fulfilmentType, pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize(RoleRules.SHOP_ORDER_STAFF)
    public ShopOrderDto get(@PathVariable UUID id) {
        return shopOrderService.adminGet(id);
    }

    @PostMapping("/{id}/ready")
    @PreAuthorize(RoleRules.SHOP_ORDER_STAFF)
    public ShopOrderDto ready(@PathVariable UUID id) {
        return shopOrderService.markReady(id);
    }

    /** Converts the reservation into a completed sale (revenue/COGS posted, points accrued for a
     * member order) - see {@code ShopOrderService#fulfilOrder}'s javadoc for the full ledger
     * model. CASHIER-permitted by design (see {@link RoleRules#SHOP_ORDER_STAFF}): a cashier
     * handing a collected order over at the till must be able to close it out unsupervised. */
    @PostMapping("/{id}/fulfil")
    @PreAuthorize(RoleRules.SHOP_ORDER_STAFF)
    public ShopOrderDto fulfil(@PathVariable UUID id, @RequestBody(required = false) FulfilOrderRequest request) {
        return shopOrderService.fulfilOrder(id, request);
    }

    /** Reverses the reservation (stock returned, SHOP_RELEASE movement) - manager-and-up only,
     * same staff/manager split as PoS void (see {@link RoleRules#SHOP_ORDER_STAFF}'s javadoc). */
    @PostMapping("/{id}/cancel")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ShopOrderDto cancel(@PathVariable UUID id) {
        return shopOrderService.cancelAdmin(id);
    }

    /** Manual trigger for the same release job the scheduler runs periodically - useful for ops
     * (and for verifying reservation expiry without waiting for the schedule/altering
     * mulaerp.shop.reservation-hours and restarting). */
    @PostMapping("/release-expired")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public Map<String, Integer> releaseExpired() {
        return Map.of("released", shopOrderService.releaseExpiredReservations());
    }

    /** V42 (Gap C): reverses a FULFILLED order - MANAGER_UP only (a cashier must not be able to
     * erase a completed sale unsupervised, same staff/manager split as PoS void, see
     * {@code PosSaleController#voidSale}/{@code RoleRules.MANAGER_UP}'s javadoc). See
     * {@code ShopOrderService#voidOrder}'s javadoc for the full reversal model (stock, revenue/
     * COGS, points/store-credit, and Gap B's warranties). */
    @PostMapping("/{id}/void")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public VoidShopOrderResponseDto voidOrder(@PathVariable UUID id, @Valid @RequestBody VoidShopOrderRequest request) {
        ShopOrderService.VoidResult result = shopOrderService.voidOrder(id, request.getReason());
        return new VoidShopOrderResponseDto(result.dto(), result.refundMethod(), result.refundAmount(),
                result.stockReturned(), result.storeCreditReversed(), result.pointsDeducted(), result.warrantiesVoided());
    }
}
