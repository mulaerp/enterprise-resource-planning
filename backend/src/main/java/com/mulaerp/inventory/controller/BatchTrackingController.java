package com.mulaerp.inventory.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.inventory.dto.CreateBatchRequest;
import com.mulaerp.inventory.dto.ProductBatchDTO;
import com.mulaerp.inventory.entity.ProductBatch;
import com.mulaerp.inventory.service.BatchTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

// CRITICAL FIX 1 (post-overhaul audit) role matrix: create/update/status-change/delete (and the
// bulk mark-expired maintenance action) are ADMIN or MANAGER (a plain USER account previously had
// no restriction at all); every GET stays open to any authenticated user.
@RestController
@RequestMapping("/api/v1/batches")
@RequiredArgsConstructor
@Tag(name = "Batch Tracking", description = "Batch/Lot tracking management")
public class BatchTrackingController {

    private final BatchTrackingService batchTrackingService;

    @GetMapping
    @Operation(summary = "Get all batches")
    public ResponseEntity<List<ProductBatchDTO>> getAllBatches() {
        return ResponseEntity.ok(batchTrackingService.getAllBatches());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get batch by ID")
    public ResponseEntity<ProductBatchDTO> getBatchById(@PathVariable UUID id) {
        return ResponseEntity.ok(batchTrackingService.getBatchById(id));
    }

    @GetMapping("/number/{batchNumber}")
    @Operation(summary = "Get batch by batch number")
    public ResponseEntity<ProductBatchDTO> getBatchByNumber(@PathVariable String batchNumber) {
        return ResponseEntity.ok(batchTrackingService.getBatchByNumber(batchNumber));
    }

    @GetMapping("/product/{productId}")
    @Operation(summary = "Get batches by product")
    public ResponseEntity<List<ProductBatchDTO>> getBatchesByProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(batchTrackingService.getBatchesByProduct(productId));
    }

    @GetMapping("/product/{productId}/active")
    @Operation(summary = "Get active batches by product")
    public ResponseEntity<List<ProductBatchDTO>> getActiveBatchesByProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(batchTrackingService.getActiveBatchesByProduct(productId));
    }

    @GetMapping("/expiring")
    @Operation(summary = "Get expiring batches")
    public ResponseEntity<List<ProductBatchDTO>> getExpiringBatches(
            @RequestParam(defaultValue = "30") int daysAhead) {
        return ResponseEntity.ok(batchTrackingService.getExpiringBatches(daysAhead));
    }

    @PostMapping
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Create new batch")
    public ResponseEntity<ProductBatchDTO> createBatch(@Valid @RequestBody CreateBatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(batchTrackingService.createBatch(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update batch")
    public ResponseEntity<ProductBatchDTO> updateBatch(
            @PathVariable UUID id,
            @Valid @RequestBody CreateBatchRequest request) {
        return ResponseEntity.ok(batchTrackingService.updateBatch(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update batch status")
    public ResponseEntity<Void> updateBatchStatus(
            @PathVariable UUID id,
            @RequestParam ProductBatch.BatchStatus status) {
        batchTrackingService.updateBatchStatus(id, status);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Delete batch")
    public ResponseEntity<Void> deleteBatch(@PathVariable UUID id) {
        batchTrackingService.deleteBatch(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/mark-expired")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Mark expired batches")
    public ResponseEntity<Void> markExpiredBatches() {
        batchTrackingService.markExpiredBatches();
        return ResponseEntity.ok().build();
    }
}
