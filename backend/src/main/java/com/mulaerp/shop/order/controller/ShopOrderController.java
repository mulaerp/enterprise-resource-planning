package com.mulaerp.shop.order.controller;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.shop.dto.ShopCustomerDto;
import com.mulaerp.shop.order.dto.PlaceShopOrderRequest;
import com.mulaerp.shop.order.dto.ShopOrderDto;
import com.mulaerp.shop.order.service.ShopOrderService;
import com.mulaerp.shop.service.ShopAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Signed-in customer's own orders ({@code /api/v1/shop/orders/**}) - protected by SecurityConfig's
 * blanket {@code hasRole('SHOP_CUSTOMER')} matcher on {@code /api/v1/shop/**}. Every method
 * resolves the current customer from {@code ShopCustomerAuthenticationFilter}'s authentication
 * (never a client-supplied id), so a customer can only ever see/act on their own orders - see
 * {@code ShopOrderService#getOwnOrder}/{@code #cancelOwnOrder}'s 403 guard.
 */
@RestController
@RequestMapping("/api/v1/shop/orders")
@RequiredArgsConstructor
public class ShopOrderController {

    private final ShopOrderService shopOrderService;
    private final ShopAuthService shopAuthService;

    @PostMapping
    public ResponseEntity<ShopOrderDto> placeOrder(@Valid @RequestBody PlaceShopOrderRequest request) {
        ShopOrderDto order = shopOrderService.placeOrder(request, currentCustomer());
        return ResponseEntity.status(HttpStatus.CREATED).body(order);
    }

    @GetMapping
    public Page<ShopOrderDto> myOrders(Pageable pageable) {
        return shopOrderService.getOwnOrders(currentCustomer().getId(), pageable);
    }

    @GetMapping("/{id}")
    public ShopOrderDto getOrder(@PathVariable UUID id) {
        return shopOrderService.getOwnOrder(currentCustomer().getId(), id);
    }

    @PostMapping("/{id}/cancel")
    public ShopOrderDto cancel(@PathVariable UUID id) {
        return shopOrderService.cancelOwnOrder(currentCustomer().getId(), id);
    }

    // Mirrors ShopAuthController#me's pattern exactly - the SHOP_CUSTOMER role check in
    // SecurityConfig already guarantees a valid MULAERP_SHOP cookie got this far.
    private ShopCustomerDto currentCustomer() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return shopAuthService.findActiveByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
    }
}
