package com.mulaerp.warehouse.repository;

import com.mulaerp.warehouse.entity.WarehouseStock;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WarehouseStockRepository extends JpaRepository<WarehouseStock, UUID> {

    Optional<WarehouseStock> findByWarehouseIdAndProductId(UUID warehouseId, UUID productId);

    List<WarehouseStock> findByWarehouseId(UUID warehouseId);

    List<WarehouseStock> findByProductId(UUID productId);

    // DATA INTEGRITY fix (post-overhaul audit): bounded overloads backing
    // WarehouseStockService#getStockByWarehouse/#getStockByProduct, which previously returned
    // every matching row with no limit at all.
    List<WarehouseStock> findByWarehouseId(UUID warehouseId, Pageable pageable);

    List<WarehouseStock> findByProductId(UUID productId, Pageable pageable);

    boolean existsByWarehouseIdAndQuantityGreaterThan(UUID warehouseId, Integer quantity);

    /**
     * DATA INTEGRITY fix (post-overhaul audit): row-level {@code SELECT ... FOR UPDATE} lock on a
     * single warehouse_stock row. Without this, two concurrent stock-transfer completions (or any
     * two concurrent mutations of the same product/warehouse pair) can both read the same
     * "available" quantity, both pass the sufficiency check, and both decrement - taking stock
     * negative. Every write path in {@link com.mulaerp.warehouse.service.WarehouseStockService}
     * (applyDelta/setQuantity/decrementValidated) goes through this locking lookup so the read
     * and the eventual write are atomic with respect to other transactions on the same row; the
     * lock is held only for the remainder of the caller's transaction and is released on
     * commit/rollback.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ws FROM WarehouseStock ws WHERE ws.warehouse.id = :warehouseId AND ws.product.id = :productId")
    Optional<WarehouseStock> findByWarehouseIdAndProductIdForUpdate(
            @Param("warehouseId") UUID warehouseId, @Param("productId") UUID productId);
}
