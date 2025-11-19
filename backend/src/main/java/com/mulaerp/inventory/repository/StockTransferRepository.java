package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.StockTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StockTransferRepository extends JpaRepository<StockTransfer, UUID> {

    Optional<StockTransfer> findByTransferNumber(String transferNumber);

    List<StockTransfer> findByStatus(StockTransfer.TransferStatus status);

    List<StockTransfer> findByFromWarehouseId(UUID fromWarehouseId);

    List<StockTransfer> findByToWarehouseId(UUID toWarehouseId);

    @Query("SELECT st FROM StockTransfer st WHERE st.fromWarehouseId = :warehouseId OR st.toWarehouseId = :warehouseId")
    List<StockTransfer> findByWarehouseId(@Param("warehouseId") UUID warehouseId);

    @Query("SELECT st FROM StockTransfer st WHERE st.transferDate BETWEEN :startDate AND :endDate")
    List<StockTransfer> findByTransferDateBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    boolean existsByTransferNumber(String transferNumber);
}
