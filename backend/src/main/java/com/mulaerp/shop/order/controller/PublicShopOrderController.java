package com.mulaerp.shop.order.controller;

import com.mulaerp.shop.order.dto.PlaceShopOrderRequest;
import com.mulaerp.shop.order.dto.ShopOrderDto;
import com.mulaerp.shop.order.service.ShopOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GUEST checkout - {@code /api/v1/public/shop/orders/**}, permitAll (no SecurityConfig change
 * needed - covered by the existing {@code "/api/v1/public/**"} matcher). No authentication, no
 * shop-customer account required; identity is whatever guestEmail/guestName/guestPhone the
 * checkout form supplied, all required (400 otherwise - see
 * {@code ShopOrderService#validatePlacement}).
 */
@RestController
@RequestMapping("/api/v1/public/shop/orders")
@RequiredArgsConstructor
public class PublicShopOrderController {

    private final ShopOrderService shopOrderService;

    @PostMapping
    public ResponseEntity<ShopOrderDto> placeGuestOrder(@Valid @RequestBody PlaceShopOrderRequest request) {
        ShopOrderDto order = shopOrderService.placeGuestOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(order);
    }

    /** Guest status lookup by order number + the email they themselves supplied at checkout - see
     * {@code ShopOrderService#guestLookup}'s javadoc for why this doubles as the "lookup token"
     * and why a mismatch always 404s rather than distinguishing "no such order" from "wrong
     * email". */
    @GetMapping("/{orderNumber}")
    public ShopOrderDto lookup(@PathVariable String orderNumber, @RequestParam String email) {
        return shopOrderService.guestLookup(orderNumber, email);
    }
}
