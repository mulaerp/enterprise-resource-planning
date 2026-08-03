package com.mulaerp.inventory.controller;

import com.mulaerp.inventory.dto.StockMovementDTO;
import com.mulaerp.inventory.dto.StockMovementReconcileDTO;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.util.PageSizeCap;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * WP7: read side of the stock movement ledger. Written exclusively by
 * {@link StockMovementService#recordMovement} from within the transactions that mutate stock
 * (InventoryService, StockTransferService, PosSaleService, PurchaseOrderService,
 * SalesOrderService) - this controller never writes movements itself.
 */
@RestController
@RequestMapping("/api/v1/inventory/movements")
@RequiredArgsConstructor
@Tag(name = "Stock Movements", description = "Append-only stock movement ledger (WP7)")
public class StockMovementController {

    private final StockMovementService stockMovementService;

    @GetMapping
    @Operation(summary = "Search the stock movement ledger, newest first")
    public ResponseEntity<Page<StockMovementDTO>> getMovements(
            @RequestParam(required = false) UUID productId,
            @RequestParam(required = false) StockMovement.MovementType movementType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("createdAt").descending());
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.atTime(LocalTime.MAX) : null;

        Page<StockMovementDTO> result = stockMovementService.searchMovements(productId, movementType, start, end, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/reconcile/{productId}")
    @Operation(summary = "Reconcile a product's ledger sum against its current stock total")
    public ResponseEntity<StockMovementReconcileDTO> reconcile(@PathVariable UUID productId) {
        return ResponseEntity.ok(stockMovementService.reconcile(productId));
    }
}
