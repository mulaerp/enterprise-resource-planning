package com.mulaerp.inventory.controller;

import com.mulaerp.inventory.dto.CreateSerialRequest;
import com.mulaerp.inventory.dto.ProductSerialDTO;
import com.mulaerp.inventory.entity.ProductSerial;
import com.mulaerp.inventory.service.SerialTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/serials")
@RequiredArgsConstructor
@Tag(name = "Serial Tracking", description = "Serial number tracking management")
public class SerialTrackingController {

    private final SerialTrackingService serialTrackingService;

    @GetMapping
    @Operation(summary = "Get all serial numbers")
    public ResponseEntity<List<ProductSerialDTO>> getAllSerials() {
        return ResponseEntity.ok(serialTrackingService.getAllSerials());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get serial by ID")
    public ResponseEntity<ProductSerialDTO> getSerialById(@PathVariable UUID id) {
        return ResponseEntity.ok(serialTrackingService.getSerialById(id));
    }

    @GetMapping("/number/{serialNumber}")
    @Operation(summary = "Get serial by serial number")
    public ResponseEntity<ProductSerialDTO> getSerialByNumber(@PathVariable String serialNumber) {
        return ResponseEntity.ok(serialTrackingService.getSerialByNumber(serialNumber));
    }

    @GetMapping("/product/{productId}")
    @Operation(summary = "Get serials by product")
    public ResponseEntity<List<ProductSerialDTO>> getSerialsByProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(serialTrackingService.getSerialsByProduct(productId));
    }

    @GetMapping("/product/{productId}/available")
    @Operation(summary = "Get available serials by product")
    public ResponseEntity<List<ProductSerialDTO>> getAvailableSerialsByProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(serialTrackingService.getAvailableSerialsByProduct(productId));
    }

    @GetMapping("/customer/{customerId}")
    @Operation(summary = "Get serials by customer")
    public ResponseEntity<List<ProductSerialDTO>> getSerialsByCustomer(@PathVariable UUID customerId) {
        return ResponseEntity.ok(serialTrackingService.getSerialsByCustomer(customerId));
    }

    @GetMapping("/warranty-expiring")
    @Operation(summary = "Get serials with expiring warranty")
    public ResponseEntity<List<ProductSerialDTO>> getWarrantyExpiring(
            @RequestParam(defaultValue = "30") int daysAhead) {
        return ResponseEntity.ok(serialTrackingService.getWarrantyExpiring(daysAhead));
    }

    @PostMapping
    @Operation(summary = "Create new serial number")
    public ResponseEntity<ProductSerialDTO> createSerial(@Valid @RequestBody CreateSerialRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(serialTrackingService.createSerial(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update serial number")
    public ResponseEntity<ProductSerialDTO> updateSerial(
            @PathVariable UUID id,
            @Valid @RequestBody CreateSerialRequest request) {
        return ResponseEntity.ok(serialTrackingService.updateSerial(id, request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update serial status")
    public ResponseEntity<Void> updateSerialStatus(
            @PathVariable UUID id,
            @RequestParam ProductSerial.SerialStatus status) {
        serialTrackingService.updateSerialStatus(id, status);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete serial number")
    public ResponseEntity<Void> deleteSerial(@PathVariable UUID id) {
        serialTrackingService.deleteSerial(id);
        return ResponseEntity.noContent().build();
    }
}
