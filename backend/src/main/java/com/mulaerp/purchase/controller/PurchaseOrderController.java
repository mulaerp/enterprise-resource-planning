package com.mulaerp.purchase.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.purchase.dto.CreatePurchaseOrderRequest;
import com.mulaerp.purchase.dto.PurchaseOrderDTO;
import com.mulaerp.purchase.dto.ReceivePurchaseOrderRequest;
import com.mulaerp.purchase.entity.PurchaseOrder;
import com.mulaerp.purchase.service.PurchaseOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// CRITICAL FIX 1 (post-overhaul audit) role matrix: create/update/status-transition/delete are
// ADMIN or MANAGER (a plain USER account previously had no restriction at all); GET/search stay
// open to any authenticated user.
@RestController
@RequestMapping("/api/v1/purchase-orders")
@RequiredArgsConstructor
@Tag(name = "Purchase Orders", description = "Purchase order management endpoints")
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    @GetMapping
    @Operation(summary = "Get all purchase orders")
    public ResponseEntity<Page<PurchaseOrderDTO>> getAllPurchaseOrders(Pageable pageable) {
        return ResponseEntity.ok(purchaseOrderService.getAllPurchaseOrders(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get purchase order by ID")
    public ResponseEntity<PurchaseOrderDTO> getPurchaseOrderById(@PathVariable UUID id) {
        return ResponseEntity.ok(purchaseOrderService.getPurchaseOrderById(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search purchase orders")
    public ResponseEntity<Page<PurchaseOrderDTO>> searchPurchaseOrders(
            @RequestParam String query,
            Pageable pageable) {
        return ResponseEntity.ok(purchaseOrderService.searchPurchaseOrders(query, pageable));
    }

    @PostMapping
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Create purchase order")
    public ResponseEntity<PurchaseOrderDTO> createPurchaseOrder(
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchaseOrderService.createPurchaseOrder(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update purchase order")
    public ResponseEntity<PurchaseOrderDTO> updatePurchaseOrder(
            @PathVariable UUID id,
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        return ResponseEntity.ok(purchaseOrderService.updatePurchaseOrder(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update purchase order status",
            description = "When transitioning to RECEIVED, an optional body may supply per-item " +
                    "batch (batchNumber/manufactureDate/expiryDate) and/or serialNumbers to register " +
                    "against inventory tracking (WP3). Omit the body for the original untracked behaviour.")
    public ResponseEntity<PurchaseOrderDTO> updateStatus(
            @PathVariable UUID id,
            @RequestParam PurchaseOrder.PurchaseOrderStatus status,
            @RequestBody(required = false) ReceivePurchaseOrderRequest request) {
        return ResponseEntity.ok(purchaseOrderService.updateStatus(id, status, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Delete purchase order")
    public ResponseEntity<Void> deletePurchaseOrder(@PathVariable UUID id) {
        purchaseOrderService.deletePurchaseOrder(id);
        return ResponseEntity.noContent().build();
    }
}
