package com.mulaerp.warehouse.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.warehouse.dto.CreateWarehouseRequest;
import com.mulaerp.warehouse.dto.UpdateWarehouseRequest;
import com.mulaerp.warehouse.dto.WarehouseDTO;
import com.mulaerp.warehouse.dto.WarehouseStockDTO;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import com.mulaerp.util.PageSizeCap;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/warehouses")
@RequiredArgsConstructor
@Tag(name = "Warehouses", description = "Warehouse management")
public class WarehouseController {

    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;

    @GetMapping
    @Operation(summary = "Get all warehouses")
    public ResponseEntity<Page<WarehouseDTO>> getAllWarehouses(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), sort);

        Page<WarehouseDTO> warehouses = search != null && !search.isEmpty()
                ? warehouseService.searchWarehouses(search, pageable)
                : warehouseService.getAllWarehouses(pageable);

        return ResponseEntity.ok(warehouses);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get warehouse by ID")
    public ResponseEntity<WarehouseDTO> getWarehouseById(@PathVariable UUID id) {
        return ResponseEntity.ok(warehouseService.getWarehouseById(id));
    }

    @GetMapping("/{id}/stock")
    @Operation(summary = "List stock levels for a warehouse")
    public ResponseEntity<List<WarehouseStockDTO>> getWarehouseStock(@PathVariable UUID id) {
        return ResponseEntity.ok(warehouseStockService.getStockByWarehouse(id));
    }

    @PostMapping
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Create new warehouse")
    public ResponseEntity<WarehouseDTO> createWarehouse(@Valid @RequestBody CreateWarehouseRequest request) {
        WarehouseDTO warehouse = warehouseService.createWarehouse(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(warehouse);
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Update warehouse")
    public ResponseEntity<WarehouseDTO> updateWarehouse(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWarehouseRequest request
    ) {
        return ResponseEntity.ok(warehouseService.updateWarehouse(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Delete warehouse")
    public ResponseEntity<Void> deleteWarehouse(@PathVariable UUID id) {
        warehouseService.deleteWarehouse(id);
        return ResponseEntity.noContent().build();
    }
}
