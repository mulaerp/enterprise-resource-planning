package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.StockAdjustmentDTO;
import com.mulaerp.inventory.entity.StockAdjustment;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.repository.StockAdjustmentRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class InventoryService {

    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final ProductRepository productRepository;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;
    private final StockMovementService stockMovementService;

    public List<StockAdjustmentDTO> getAllAdjustments() {
        return stockAdjustmentRepository.findByDeletedFalse().stream()
            .map(StockAdjustmentDTO::fromEntity)
            .collect(Collectors.toList());
    }

    public StockAdjustmentDTO getAdjustmentById(UUID id) {
        StockAdjustment adjustment = stockAdjustmentRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Stock adjustment not found"));
        return StockAdjustmentDTO.fromEntity(adjustment);
    }

    public StockAdjustmentDTO createAdjustment(StockAdjustmentDTO dto) {
        Product product = productRepository.findById(dto.getProductId())
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        // Default to the MAIN warehouse when the caller doesn't specify one, so pre-multi-
        // warehouse flows still have a home for their warehouse_stock row.
        UUID warehouseId = dto.getWarehouseId() != null ? dto.getWarehouseId() : warehouseService.getDefaultWarehouseId();

        StockAdjustment adjustment = new StockAdjustment();
        adjustment.setAdjustmentNumber(generateAdjustmentNumber());
        adjustment.setProduct(product);
        adjustment.setWarehouseId(warehouseId);
        adjustment.setAdjustmentType(dto.getAdjustmentType());
        adjustment.setQuantityBefore(product.getStockQuantity());
        adjustment.setQuantityAdjusted(dto.getQuantityAdjusted());

        // Calculate new quantity
        int newQuantity = product.getStockQuantity();
        if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.INCREASE) {
            newQuantity += dto.getQuantityAdjusted();
        } else if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.DECREASE) {
            newQuantity -= dto.getQuantityAdjusted();
        } else if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.RECOUNT) {
            newQuantity = dto.getQuantityAdjusted();
        }

        // PROBLEM 2 fix (negative-stock guard): reject a result below zero with a clear 400
        // unless the caller explicitly asked for allowNegative AND actually holds ADMIN - a
        // non-admin's allowNegative=true is treated exactly as if it had never been sent.
        boolean allowNegative = Boolean.TRUE.equals(dto.getAllowNegative()) && callerIsAdmin();
        if (newQuantity < 0 && !allowNegative) {
            throw new IllegalArgumentException(String.format(
                    "Adjustment would take product %s stock negative: current %d, requested change would result in %d",
                    product.getSku(), product.getStockQuantity(), newQuantity));
        }

        adjustment.setQuantityAfter(newQuantity);
        adjustment.setReason(dto.getReason());
        adjustment.setNotes(dto.getNotes());
        adjustment.setAdjustmentDate(dto.getAdjustmentDate() != null ? dto.getAdjustmentDate() : LocalDate.now());
        adjustment.setApprovedBy(dto.getApprovedBy());

        // Update product stock
        product.setStockQuantity(newQuantity);
        productRepository.save(product);

        // Stock model: Product.stockQuantity stays the authoritative TOTAL across every
        // warehouse (unchanged behaviour). warehouse_stock is kept alongside it as the
        // per-warehouse breakdown: INCREASE/DECREASE apply the same signed delta used above,
        // RECOUNT sets that warehouse's row to the recounted value directly - mirroring exactly
        // what's done to Product.stockQuantity, including its known limitation that RECOUNT
        // doesn't reconcile against other warehouses' rows. DECREASE is intentionally not
        // validated against available warehouse stock here (no such check exists against
        // Product.stockQuantity either), so an adjustment can't succeed at the product level
        // while being rejected at the warehouse level.
        int ledgerDelta;
        StockMovement.MovementType movementType;
        if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.RECOUNT) {
            warehouseStockService.setQuantity(warehouseId, product, dto.getQuantityAdjusted(), allowNegative);
            // RECOUNT sets an absolute value, not a relative one - the ledger records the actual
            // signed change this caused (newQuantity vs the pre-adjustment total), not the
            // recounted value itself.
            ledgerDelta = newQuantity - adjustment.getQuantityBefore();
            movementType = StockMovement.MovementType.RECOUNT;
        } else {
            int delta = dto.getAdjustmentType() == StockAdjustment.AdjustmentType.INCREASE
                    ? dto.getQuantityAdjusted() : -dto.getQuantityAdjusted();
            warehouseStockService.applyDelta(warehouseId, product, delta, allowNegative);
            ledgerDelta = delta;
            movementType = StockMovement.MovementType.ADJUSTMENT;
        }

        adjustment = stockAdjustmentRepository.save(adjustment);

        // WP7: ledger row in the same transaction as the mutation above - never try/caught away.
        stockMovementService.recordMovement(product, warehouseId, movementType, ledgerDelta,
                adjustment.getAdjustmentNumber(), dto.getNotes());

        return StockAdjustmentDTO.fromEntity(adjustment);
    }

    public void deleteAdjustment(UUID id) {
        StockAdjustment adjustment = stockAdjustmentRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Stock adjustment not found"));

        adjustment.setDeleted(true);
        stockAdjustmentRepository.save(adjustment);
    }

    public List<StockAdjustmentDTO> getAdjustmentsByProduct(UUID productId) {
        return stockAdjustmentRepository.findByProductIdAndDeletedFalse(productId).stream()
            .map(StockAdjustmentDTO::fromEntity)
            .collect(Collectors.toList());
    }

    // Second-precision timestamp alone isn't unique - two adjustments created within the same
    // wall-clock second (easily hit under concurrent/parallel callers, e.g. the Playwright
    // suite's parallel workers) would collide on the DB's unique constraint. A short random hex
    // suffix makes the number unique by construction without needing a fragile retry across the
    // transaction boundary.
    private String generateAdjustmentNumber() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return "ADJ-" + timestamp + "-" + suffix;
    }

    /** See StockAdjustmentDTO#allowNegative - the flag it gates is only ever honoured for ADMIN. */
    private boolean callerIsAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
    }
}
