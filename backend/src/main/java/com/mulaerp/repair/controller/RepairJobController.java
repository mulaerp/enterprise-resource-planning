package com.mulaerp.repair.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.repair.dto.AddRepairPartRequest;
import com.mulaerp.repair.dto.CreateRepairPaymentRequest;
import com.mulaerp.repair.dto.CreateRepairRequest;
import com.mulaerp.repair.dto.RefundRepairPaymentRequest;
import com.mulaerp.repair.dto.RepairJobDto;
import com.mulaerp.repair.dto.UpdateRepairRequest;
import com.mulaerp.repair.service.RepairJobService;
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

/** Staff endpoints (any authenticated user) - repairs + warranties per the REPAIR contract.
 * Exception: refunding a payment (V37) is {@link RoleRules#MANAGER_UP} - refunding money out of
 * the business is deliberately not cashier work, unlike every other endpoint in this controller. */
@RestController
@RequestMapping("/api/v1/repairs")
@RequiredArgsConstructor
public class RepairJobController {

    private final RepairJobService repairJobService;

    @GetMapping
    public ResponseEntity<Page<RepairJobDto>> getAllRepairs(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("receivedAt").descending());
        return ResponseEntity.ok(repairJobService.getAllRepairs(status, search, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepairJobDto> getRepairById(@PathVariable UUID id) {
        return ResponseEntity.ok(repairJobService.getRepairById(id));
    }

    @PostMapping
    public ResponseEntity<RepairJobDto> createRepair(@Valid @RequestBody CreateRepairRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(repairJobService.createRepair(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RepairJobDto> updateRepair(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRepairRequest request
    ) {
        return ResponseEntity.ok(repairJobService.updateRepair(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<RepairJobDto> updateStatus(@PathVariable UUID id, @RequestParam String status) {
        return ResponseEntity.ok(repairJobService.updateStatus(id, status));
    }

    @PostMapping("/{id}/parts")
    public ResponseEntity<RepairJobDto> addPart(@PathVariable UUID id, @Valid @RequestBody AddRepairPartRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(repairJobService.addPart(id, request));
    }

    @DeleteMapping("/{id}/parts/{partId}")
    public ResponseEntity<RepairJobDto> removePart(@PathVariable UUID id, @PathVariable UUID partId) {
        return ResponseEntity.ok(repairJobService.removePart(id, partId));
    }

    @PostMapping("/{id}/payments")
    public ResponseEntity<RepairJobDto> addPayment(@PathVariable UUID id, @Valid @RequestBody CreateRepairPaymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(repairJobService.addPayment(id, request));
    }

    /** V37: MANAGER_UP only - see class javadoc. */
    @PostMapping("/{id}/payments/{paymentId}/refund")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<RepairJobDto> refundPayment(
            @PathVariable UUID id,
            @PathVariable UUID paymentId,
            @Valid @RequestBody RefundRepairPaymentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(repairJobService.refundPayment(id, paymentId, request));
    }
}
