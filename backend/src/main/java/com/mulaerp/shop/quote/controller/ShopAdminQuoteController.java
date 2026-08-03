package com.mulaerp.shop.quote.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.shop.quote.dto.InspectQuoteRequest;
import com.mulaerp.shop.quote.dto.ShopTradeInQuoteDto;
import com.mulaerp.shop.quote.service.ShopTradeInQuoteService;
import com.mulaerp.util.PageSizeCap;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Staff side of postal/drop-off trade-in quotes - {@code /api/v1/shop/admin/quotes}. Deliberately
 * carved out of the blanket {@code /api/v1/shop/** -> hasRole('SHOP_CUSTOMER')} rule in
 * SecurityConfig (see the {@code /api/v1/shop/admin/**} matcher added there, positioned before
 * that blanket rule so it wins) - a staff-authenticated request has no {@code ROLE_SHOP_CUSTOMER}
 * authority and would otherwise be 403'd before ever reaching this controller.
 *
 * <p><b>Class-level {@code @PreAuthorize(RoleRules.ANY_STAFF_ROLE)}</b> - NOT the
 * no-{@code @PreAuthorize}-at-all shape used by e.g. {@code PosTradeInController}. That precedent
 * relies on the controller's path never being authenticated by {@code
 * ShopCustomerAuthenticationFilter}, which is true for {@code /api/v1/pos/**} but NOT for this
 * controller: it lives under {@code /api/v1/shop/**}, which that filter DOES run against, and the
 * {@code /api/v1/shop/admin/**} SecurityConfig matcher is only {@code authenticated()} - satisfied
 * just as well by a shop customer's own {@code ROLE_SHOP_CUSTOMER} authentication as by staff.
 * Verified live during the WEBSHOP verification gate: before this annotation was added, a
 * logged-in shop customer could {@code GET} this entire list (every customer's and guest's
 * trade-in quotes - PII, quoted amounts) and invoke every mutating endpoint below on an arbitrary
 * quote id. See {@link RoleRules#ANY_STAFF_ROLE}'s javadoc for the full explanation. Any
 * authenticated staff role (ADMIN/MANAGER/ACCOUNTANT/INVENTORY/CASHIER) may use every endpoint
 * here - unchanged from the original intent, just now actually enforced.
 */
@RestController
@RequestMapping("/api/v1/shop/admin/quotes")
@RequiredArgsConstructor
@PreAuthorize(RoleRules.ANY_STAFF_ROLE)
public class ShopAdminQuoteController {

    private final ShopTradeInQuoteService quoteService;

    @GetMapping
    public ResponseEntity<Page<ShopTradeInQuoteDto>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String deliveryMethod,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("createdAt").descending());
        return ResponseEntity.ok(quoteService.adminList(status, deliveryMethod, pageable));
    }

    /** QUOTED -> RECEIVED: the item physically arrived. */
    @PostMapping("/{id}/receive")
    public ResponseEntity<ShopTradeInQuoteDto> receive(@PathVariable UUID id) {
        return ResponseEntity.ok(quoteService.receive(id));
    }

    /** RECEIVED -> OFFER_MADE: staff records the final offer after physical inspection. */
    @PostMapping("/{id}/inspect")
    public ResponseEntity<ShopTradeInQuoteDto> inspect(@PathVariable UUID id, @Valid @RequestBody InspectQuoteRequest request) {
        return ResponseEntity.ok(quoteService.inspect(id, request));
    }

    /** ACCEPTED -> COMPLETED: creates the REAL trade-in via the existing PosTradeInService. */
    @PostMapping("/{id}/complete")
    public ResponseEntity<ShopTradeInQuoteDto> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(quoteService.complete(id));
    }

    /** DECLINED -> RETURNED: item physically handed back, no stock/journal effect. */
    @PostMapping("/{id}/return")
    public ResponseEntity<ShopTradeInQuoteDto> returnItem(@PathVariable UUID id) {
        return ResponseEntity.ok(quoteService.returnItem(id));
    }
}
