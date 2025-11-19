package com.mulaerp.purchase.controller;

import com.mulaerp.purchase.dto.CreatePurchaseOrderRequest;
import com.mulaerp.purchase.dto.PurchaseOrderDTO;
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
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

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
    @Operation(summary = "Create purchase order")
    public ResponseEntity<PurchaseOrderDTO> createPurchaseOrder(
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchaseOrderService.createPurchaseOrder(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update purchase order")
    public ResponseEntity<PurchaseOrderDTO> updatePurchaseOrder(
            @PathVariable UUID id,
            @Valid @RequestBody CreatePurchaseOrderRequest request) {
        return ResponseEntity.ok(purchaseOrderService.updatePurchaseOrder(id, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update purchase order status")
    public ResponseEntity<PurchaseOrderDTO> updateStatus(
            @PathVariable UUID id,
            @RequestParam PurchaseOrder.PurchaseOrderStatus status) {
        return ResponseEntity.ok(purchaseOrderService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete purchase order")
    public ResponseEntity<Void> deletePurchaseOrder(@PathVariable UUID id) {
        purchaseOrderService.deletePurchaseOrder(id);
        return ResponseEntity.noContent().build();
    }
}
