package com.mulaerp.inventory.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.inventory.dto.OpenStockTakeRequest;
import com.mulaerp.inventory.dto.RecordStockTakeCountRequest;
import com.mulaerp.inventory.dto.StockTakeLineDTO;
import com.mulaerp.inventory.dto.StockTakeSessionDTO;
import com.mulaerp.inventory.service.StockTakeService;
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

import java.util.UUID;

/** Guided stock-take (physical count) workflow - see the `inventory` skill for the full lifecycle. */
@RestController
@RequestMapping("/api/v1/inventory/stock-takes")
@RequiredArgsConstructor
@Tag(name = "Stock Takes", description = "Guided stock-take (physical count) sessions")
public class StockTakeController {

    private final StockTakeService stockTakeService;

    @PostMapping
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Open a stock take for a warehouse, snapshotting expected quantities")
    public ResponseEntity<StockTakeSessionDTO> open(@Valid @RequestBody OpenStockTakeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stockTakeService.openSession(request));
    }

    @GetMapping
    @Operation(summary = "List stock takes, optionally filtered by status")
    public ResponseEntity<Page<StockTakeSessionDTO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("openedAt").descending());
        return ResponseEntity.ok(stockTakeService.listSessions(status, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a stock take's header and summary counts")
    public ResponseEntity<StockTakeSessionDTO> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(stockTakeService.getSession(id));
    }

    @GetMapping("/{id}/lines")
    @Operation(summary = "Paginated count sheet lines for a stock take")
    public ResponseEntity<Page<StockTakeLineDTO>> getLines(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "false") boolean onlyVariances,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("id"));
        return ResponseEntity.ok(stockTakeService.getLines(id, onlyVariances, pageable));
    }

    @PutMapping("/{id}/lines/{lineId}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Record a counted quantity for one line")
    public ResponseEntity<StockTakeLineDTO> recordCount(
            @PathVariable UUID id,
            @PathVariable UUID lineId,
            @Valid @RequestBody RecordStockTakeCountRequest request
    ) {
        return ResponseEntity.ok(stockTakeService.recordCount(id, lineId, request));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Submit a stock take for manager review")
    public ResponseEntity<StockTakeSessionDTO> submit(@PathVariable UUID id) {
        return ResponseEntity.ok(stockTakeService.submit(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(RoleRules.MANAGER_UP)
    @Operation(summary = "Approve a stock take - creates one RECOUNT adjustment per variance line")
    public ResponseEntity<StockTakeSessionDTO> approve(@PathVariable UUID id) {
        return ResponseEntity.ok(stockTakeService.approve(id));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Cancel a stock take - no stock effect")
    public ResponseEntity<StockTakeSessionDTO> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(stockTakeService.cancel(id));
    }
}
