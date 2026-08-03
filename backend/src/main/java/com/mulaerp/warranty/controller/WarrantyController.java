package com.mulaerp.warranty.controller;

import com.mulaerp.repair.dto.RepairJobDto;
import com.mulaerp.warranty.dto.ClaimWarrantyRequest;
import com.mulaerp.warranty.dto.CreateWarrantyRequest;
import com.mulaerp.warranty.dto.WarrantyDto;
import com.mulaerp.warranty.service.WarrantyService;
import com.mulaerp.auth.security.RoleRules;
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

/** Staff endpoints (any authenticated user, except void which is MANAGER+). */
@RestController
@RequestMapping("/api/v1/warranties")
@RequiredArgsConstructor
public class WarrantyController {

    private final WarrantyService warrantyService;

    @GetMapping
    public ResponseEntity<Page<WarrantyDto>> getAllWarranties(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("createdAt").descending());
        return ResponseEntity.ok(warrantyService.getAllWarranties(status, search, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WarrantyDto> getWarrantyById(@PathVariable UUID id) {
        return ResponseEntity.ok(warrantyService.getWarrantyById(id));
    }

    @PostMapping
    public ResponseEntity<WarrantyDto> createWarranty(@Valid @RequestBody CreateWarrantyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(warrantyService.createWarranty(request));
    }

    @PostMapping("/{id}/void")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<WarrantyDto> voidWarranty(@PathVariable UUID id) {
        return ResponseEntity.ok(warrantyService.voidWarranty(id));
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<RepairJobDto> claimWarranty(
            @PathVariable UUID id,
            @Valid @RequestBody ClaimWarrantyRequest request
    ) {
        return ResponseEntity.ok(warrantyService.claimWarranty(id, request));
    }
}
