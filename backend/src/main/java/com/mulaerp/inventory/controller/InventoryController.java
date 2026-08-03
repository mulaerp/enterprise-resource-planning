package com.mulaerp.inventory.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.inventory.dto.StockAdjustmentDTO;
import com.mulaerp.inventory.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@Tag(name = "Inventory", description = "Advanced inventory management APIs")
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/adjustments")
    @Operation(summary = "Get all stock adjustments")
    public ResponseEntity<List<StockAdjustmentDTO>> getAllAdjustments() {
        return ResponseEntity.ok(inventoryService.getAllAdjustments());
    }

    @GetMapping("/adjustments/{id}")
    @Operation(summary = "Get stock adjustment by ID")
    public ResponseEntity<StockAdjustmentDTO> getAdjustmentById(@PathVariable UUID id) {
        return ResponseEntity.ok(inventoryService.getAdjustmentById(id));
    }

    @GetMapping("/adjustments/product/{productId}")
    @Operation(summary = "Get adjustments by product")
    public ResponseEntity<List<StockAdjustmentDTO>> getAdjustmentsByProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(inventoryService.getAdjustmentsByProduct(productId));
    }

    @PostMapping("/adjustments")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Create stock adjustment")
    public ResponseEntity<StockAdjustmentDTO> createAdjustment(@RequestBody StockAdjustmentDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(inventoryService.createAdjustment(dto));
    }

    // Gated the same as create (see WP12 spec's "stock adjustments/transfers create") - deleting
    // an adjustment is the same class of stock-affecting mutation.
    @DeleteMapping("/adjustments/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Delete stock adjustment")
    public ResponseEntity<Void> deleteAdjustment(@PathVariable UUID id) {
        inventoryService.deleteAdjustment(id);
        return ResponseEntity.noContent().build();
    }
}
