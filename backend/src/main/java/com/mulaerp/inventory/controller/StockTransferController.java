package com.mulaerp.inventory.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.inventory.dto.CreateStockTransferRequest;
import com.mulaerp.inventory.dto.StockTransferDTO;
import com.mulaerp.inventory.entity.StockTransfer;
import com.mulaerp.inventory.service.StockTransferService;
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

@RestController
@RequestMapping("/api/v1/stock-transfers")
@RequiredArgsConstructor
@Tag(name = "Stock Transfers", description = "Stock transfer management")
public class StockTransferController {

    private final StockTransferService stockTransferService;

    @GetMapping
    @Operation(summary = "Get all stock transfers")
    public ResponseEntity<List<StockTransferDTO>> getAllTransfers() {
        return ResponseEntity.ok(stockTransferService.getAllTransfers());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get stock transfer by ID")
    public ResponseEntity<StockTransferDTO> getTransferById(@PathVariable UUID id) {
        return ResponseEntity.ok(stockTransferService.getTransferById(id));
    }

    @GetMapping("/number/{transferNumber}")
    @Operation(summary = "Get stock transfer by transfer number")
    public ResponseEntity<StockTransferDTO> getTransferByNumber(@PathVariable String transferNumber) {
        return ResponseEntity.ok(stockTransferService.getTransferByNumber(transferNumber));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get stock transfers by status")
    public ResponseEntity<List<StockTransferDTO>> getTransfersByStatus(@PathVariable StockTransfer.TransferStatus status) {
        return ResponseEntity.ok(stockTransferService.getTransfersByStatus(status));
    }

    @GetMapping("/warehouse/{warehouseId}")
    @Operation(summary = "Get stock transfers by warehouse")
    public ResponseEntity<List<StockTransferDTO>> getTransfersByWarehouse(@PathVariable UUID warehouseId) {
        return ResponseEntity.ok(stockTransferService.getTransfersByWarehouse(warehouseId));
    }

    @PostMapping
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Create new stock transfer")
    public ResponseEntity<StockTransferDTO> createTransfer(@Valid @RequestBody CreateStockTransferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stockTransferService.createTransfer(request));
    }

    // WP12 spec calls out "stock transfers create" explicitly; the remaining mutations below
    // (update/status/complete/cancel/delete) are gated the same way for consistency - leaving them
    // open while only create was locked down would be an inconsistent gap in the same workflow.
    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update stock transfer")
    public ResponseEntity<StockTransferDTO> updateTransfer(
            @PathVariable UUID id,
            @Valid @RequestBody CreateStockTransferRequest request) {
        return ResponseEntity.ok(stockTransferService.updateTransfer(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update stock transfer status")
    public ResponseEntity<Void> updateTransferStatus(
            @PathVariable UUID id,
            @RequestParam StockTransfer.TransferStatus status) {
        stockTransferService.updateTransferStatus(id, status);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Complete stock transfer")
    public ResponseEntity<Void> completeTransfer(@PathVariable UUID id) {
        stockTransferService.completeTransfer(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Cancel stock transfer")
    public ResponseEntity<Void> cancelTransfer(@PathVariable UUID id) {
        stockTransferService.cancelTransfer(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Delete stock transfer")
    public ResponseEntity<Void> deleteTransfer(@PathVariable UUID id) {
        stockTransferService.deleteTransfer(id);
        return ResponseEntity.noContent().build();
    }
}
