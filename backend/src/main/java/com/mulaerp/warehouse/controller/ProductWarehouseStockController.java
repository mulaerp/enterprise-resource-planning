package com.mulaerp.warehouse.controller;

import com.mulaerp.warehouse.dto.WarehouseStockDTO;
import com.mulaerp.warehouse.service.WarehouseStockService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Exposes GET /api/v1/products/{id}/warehouse-stock without touching ProductController - kept as
 * its own controller (no class-level @RequestMapping) so the absolute path below is used as-is
 * rather than combined with another controller's base path.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Warehouses", description = "Per-product warehouse stock breakdown")
public class ProductWarehouseStockController {

    private final WarehouseStockService warehouseStockService;

    @GetMapping("/api/v1/products/{id}/warehouse-stock")
    @Operation(summary = "List a product's stock levels across all warehouses")
    public ResponseEntity<List<WarehouseStockDTO>> getProductWarehouseStock(@PathVariable UUID id) {
        return ResponseEntity.ok(warehouseStockService.getStockByProduct(id));
    }
}
