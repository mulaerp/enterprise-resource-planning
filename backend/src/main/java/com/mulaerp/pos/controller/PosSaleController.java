package com.mulaerp.pos.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.pos.dto.CreatePosSaleRequest;
import com.mulaerp.pos.dto.PosSaleDto;
import com.mulaerp.pos.dto.VoidPosSaleRequest;
import com.mulaerp.pos.dto.VoidPosSaleResponseDto;
import com.mulaerp.pos.service.PosSaleService;
import com.mulaerp.util.PageSizeCap;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pos/sales")
@RequiredArgsConstructor
public class PosSaleController {

    private final PosSaleService posSaleService;

    @GetMapping
    public ResponseEntity<Page<PosSaleDto>> getAllSales(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size));
        return ResponseEntity.ok(posSaleService.getAllSales(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PosSaleDto> getSaleById(@PathVariable UUID id) {
        return ResponseEntity.ok(posSaleService.getSaleById(id));
    }

    /**
     * IDEMPOTENT: a replayed clientSaleId (offline sync retry) returns the existing sale with
     * HTTP 200; a genuinely new sale returns HTTP 201.
     */
    @PostMapping
    public ResponseEntity<PosSaleDto> createSale(@Valid @RequestBody CreatePosSaleRequest request) {
        PosSaleService.SaleResult result = posSaleService.createSale(request);
        HttpStatus status = result.created() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(result.dto());
    }

    /**
     * V34/V36: RoleRules.MANAGER_UP - a cashier must not be able to erase their own mistakes
     * silently, so this is a deliberate manager/admin-only action (unlike every other endpoint on
     * this controller, which is open to any authenticated staff role - see the pos skill). Since
     * V36, this also reverses a part-exchange sale's trade-in leg in full (see PosSaleService).
     */
    @PostMapping("/{id}/void")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<VoidPosSaleResponseDto> voidSale(
            @PathVariable UUID id,
            @Valid @RequestBody VoidPosSaleRequest request
    ) {
        PosSaleService.VoidResult result = posSaleService.voidSale(id, request.getReason());
        VoidPosSaleResponseDto response = new VoidPosSaleResponseDto(
                result.dto(),
                result.refundMethod(),
                result.refundAmount(),
                result.stockReturned(),
                result.tradeInItemRemoved(),
                result.storeCreditReversed(),
                result.pointsDeducted(),
                result.tradeInStoreCreditDeducted()
        );
        return ResponseEntity.ok(response);
    }
}
