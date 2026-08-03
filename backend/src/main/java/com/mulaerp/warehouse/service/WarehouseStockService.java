package com.mulaerp.warehouse.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.product.entity.Product;
import com.mulaerp.warehouse.dto.WarehouseStockDTO;
import com.mulaerp.warehouse.entity.Warehouse;
import com.mulaerp.warehouse.entity.WarehouseStock;
import com.mulaerp.warehouse.repository.WarehouseRepository;
import com.mulaerp.warehouse.repository.WarehouseStockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Owns all reads/writes of per-warehouse stock levels ({@code warehouse_stock}). Called from
 * InventoryService (stock adjustments) and StockTransferService (stock transfers) so the two
 * flows that move stock stay consistent about how warehouse_stock rows are created/updated.
 */
@Service
@RequiredArgsConstructor
public class WarehouseStockService {

    // DATA INTEGRITY fix (post-overhaul audit): #getStockByWarehouse/#getStockByProduct
    // previously returned every matching row unbounded. Kept as a plain List (not a Page<>, to
    // avoid a breaking API-shape change for existing callers) but capped at a generous bound - a
    // single warehouse's or product's stock breakdown realistically never approaches this.
    private static final int MAX_ROWS = 1000;

    private final WarehouseStockRepository warehouseStockRepository;
    private final WarehouseRepository warehouseRepository;

    @Transactional(readOnly = true)
    public List<WarehouseStockDTO> getStockByWarehouse(UUID warehouseId) {
        if (!warehouseRepository.existsById(warehouseId)) {
            throw new ResourceNotFoundException("Warehouse not found with id: " + warehouseId);
        }
        Pageable bound = PageRequest.of(0, MAX_ROWS, Sort.by("id"));
        return warehouseStockRepository.findByWarehouseId(warehouseId, bound).stream()
                .map(WarehouseStockDTO::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WarehouseStockDTO> getStockByProduct(UUID productId) {
        Pageable bound = PageRequest.of(0, MAX_ROWS, Sort.by("id"));
        return warehouseStockRepository.findByProductId(productId, bound).stream()
                .map(WarehouseStockDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Applies a signed delta to a warehouse's stock of a product, creating the warehouse_stock
     * row if it doesn't exist yet. Equivalent to {@code applyDelta(warehouseId, product, delta,
     * false)} - rejects a negative result. Kept for the existing callers (ProductService opening
     * stock, StockTransferService's incoming leg) whose deltas are never negative in practice.
     */
    @Transactional
    public void applyDelta(UUID warehouseId, Product product, int delta) {
        applyDelta(warehouseId, product, delta, false);
    }

    /**
     * PROBLEM 2 fix (negative-stock guard): same as {@link #applyDelta(UUID, Product, int)} but
     * lets the InventoryService adjustment path opt out of the below-zero rejection via
     * {@code allowNegative} - gated to ADMIN by the caller (see
     * InventoryService#createAdjustment), never trusted from this method's own caller alone.
     */
    @Transactional
    public void applyDelta(UUID warehouseId, Product product, int delta, boolean allowNegative) {
        WarehouseStock stock = getOrCreate(warehouseId, product);
        int result = stock.getQuantity() + delta;
        if (result < 0 && !allowNegative) {
            throw new IllegalArgumentException(String.format(
                    "Adjustment would take warehouse stock negative for product %s in warehouse %s: current %d, delta %d",
                    product.getSku(), warehouseId, stock.getQuantity(), delta));
        }
        stock.setQuantity(result);
        recomputeAvailable(stock);
        warehouseStockRepository.save(stock);
    }

    /** Sets a warehouse's stock of a product to an absolute value (used for RECOUNT). */
    @Transactional
    public void setQuantity(UUID warehouseId, Product product, int quantity) {
        setQuantity(warehouseId, product, quantity, false);
    }

    /** See {@link #applyDelta(UUID, Product, int, boolean)} - same allowNegative contract. */
    @Transactional
    public void setQuantity(UUID warehouseId, Product product, int quantity, boolean allowNegative) {
        if (quantity < 0 && !allowNegative) {
            throw new IllegalArgumentException(String.format(
                    "Recount would set negative warehouse stock for product %s in warehouse %s: %d",
                    product.getSku(), warehouseId, quantity));
        }
        WarehouseStock stock = getOrCreate(warehouseId, product);
        stock.setQuantity(quantity);
        recomputeAvailable(stock);
        warehouseStockRepository.save(stock);
    }

    /**
     * Decrements a warehouse's stock of a product, rejecting the operation if there isn't
     * enough available. Used by stock transfers, where moving more than is on hand at the
     * source warehouse must fail the whole transfer.
     */
    @Transactional
    public void decrementValidated(UUID warehouseId, Product product, int quantity) {
        WarehouseStock stock = getOrCreate(warehouseId, product);
        int available = stock.getQuantity();
        if (available < quantity) {
            throw new IllegalArgumentException(String.format(
                    "Insufficient stock for product %s in warehouse %s: available %d, requested %d",
                    product.getSku(), warehouseId, available, quantity));
        }
        stock.setQuantity(stock.getQuantity() - quantity);
        recomputeAvailable(stock);
        warehouseStockRepository.save(stock);
    }

    public boolean hasStock(UUID warehouseId) {
        return warehouseStockRepository.existsByWarehouseIdAndQuantityGreaterThan(warehouseId, 0);
    }

    // DATA INTEGRITY fix: locking find (SELECT ... FOR UPDATE) so two concurrent mutations of the
    // same warehouse/product row (e.g. two parallel StockTransferService#completeTransfer calls)
    // serialize instead of both reading the same stale quantity and both passing a sufficiency
    // check that only one of them should pass - see WarehouseStockRepository#findByWarehouseIdAndProductIdForUpdate.
    private WarehouseStock getOrCreate(UUID warehouseId, Product product) {
        return warehouseStockRepository.findByWarehouseIdAndProductIdForUpdate(warehouseId, product.getId())
                .orElseGet(() -> {
                    Warehouse warehouse = warehouseRepository.findById(warehouseId)
                            .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + warehouseId));
                    WarehouseStock stock = new WarehouseStock();
                    stock.setWarehouse(warehouse);
                    stock.setProduct(product);
                    stock.setQuantity(0);
                    stock.setReservedQuantity(0);
                    stock.setAvailableQuantity(0);
                    stock.setReorderLevel(0);
                    return stock;
                });
    }

    private void recomputeAvailable(WarehouseStock stock) {
        int reserved = stock.getReservedQuantity() != null ? stock.getReservedQuantity() : 0;
        stock.setAvailableQuantity(stock.getQuantity() - reserved);
    }
}
