package com.mulaerp.supplier.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.supplier.dto.*;
import com.mulaerp.supplier.service.SupplierService;
import com.mulaerp.util.PageSizeCap;
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

import java.util.UUID;

// CRITICAL FIX 1 (post-overhaul audit) role matrix: create/update/delete are ADMIN or MANAGER (a
// plain USER account previously had no restriction); every GET stays open to any authenticated user.
@RestController
@RequestMapping("/api/v1/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierService supplierService;

    @GetMapping
    public ResponseEntity<Page<SupplierDto>> getAllSuppliers(
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

        Page<SupplierDto> suppliers = search != null && !search.isEmpty()
                ? supplierService.searchSuppliers(search, pageable)
                : supplierService.getAllSuppliers(pageable);

        return ResponseEntity.ok(suppliers);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupplierDto> getSupplierById(@PathVariable UUID id) {
        SupplierDto supplier = supplierService.getSupplierById(id);
        return ResponseEntity.ok(supplier);
    }

    @PostMapping
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    public ResponseEntity<SupplierDto> createSupplier(@Valid @RequestBody CreateSupplierRequest request) {
        SupplierDto supplier = supplierService.createSupplier(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(supplier);
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    public ResponseEntity<SupplierDto> updateSupplier(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSupplierRequest request
    ) {
        SupplierDto supplier = supplierService.updateSupplier(id, request);
        return ResponseEntity.ok(supplier);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    public ResponseEntity<Void> deleteSupplier(@PathVariable UUID id) {
        supplierService.deleteSupplier(id);
        return ResponseEntity.noContent().build();
    }
}
