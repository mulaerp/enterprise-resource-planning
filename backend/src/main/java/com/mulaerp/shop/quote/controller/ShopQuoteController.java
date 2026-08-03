package com.mulaerp.shop.quote.controller;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.shop.quote.dto.RequestTradeInQuoteRequest;
import com.mulaerp.shop.quote.dto.ShopTradeInQuoteDto;
import com.mulaerp.shop.quote.service.ShopTradeInQuoteService;
import com.mulaerp.shop.service.ShopAuthService;
import com.mulaerp.util.PageSizeCap;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Logged-in customer's own postal/drop-off trade-in quotes - {@code /api/v1/shop/quotes}, covered
 * by SecurityConfig's existing {@code /api/v1/shop/**} -&gt; {@code hasRole('SHOP_CUSTOMER')}
 * matcher (no security change needed for this controller, unlike the staff admin controller).
 * {@code ShopCustomerAuthenticationFilter} has already populated the authentication's name with
 * the customer's email by the time any method here runs.
 */
@RestController
@RequestMapping("/api/v1/shop/quotes")
@RequiredArgsConstructor
public class ShopQuoteController {

    private final ShopTradeInQuoteService quoteService;
    private final ShopAuthService shopAuthService;

    /** Auto-attaches the logged-in customer's id - no guest fields needed/accepted here. */
    @PostMapping
    public ResponseEntity<ShopTradeInQuoteDto> requestQuote(@Valid @RequestBody RequestTradeInQuoteRequest request) {
        ShopTradeInQuoteDto dto = quoteService.requestQuote(request, currentCustomerId());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<Page<ShopTradeInQuoteDto>> getOwnQuotes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("createdAt").descending());
        return ResponseEntity.ok(quoteService.getOwnQuotes(currentCustomerId(), pageable));
    }

    /** Customer's decision on the FINAL offer (own only - 403 otherwise, see
     * ShopTradeInQuoteService#acceptOffer). */
    @PostMapping("/{id}/accept-offer")
    public ResponseEntity<ShopTradeInQuoteDto> acceptOffer(@PathVariable UUID id) {
        return ResponseEntity.ok(quoteService.acceptOffer(id, currentCustomerId()));
    }

    @PostMapping("/{id}/decline-offer")
    public ResponseEntity<ShopTradeInQuoteDto> declineOffer(@PathVariable UUID id) {
        return ResponseEntity.ok(quoteService.declineOffer(id, currentCustomerId()));
    }

    private UUID currentCustomerId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return shopAuthService.findActiveByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"))
                .getId();
    }
}
