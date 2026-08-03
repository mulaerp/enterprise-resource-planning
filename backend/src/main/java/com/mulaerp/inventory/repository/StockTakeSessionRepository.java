package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.StockTakeSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * JpaSpecificationExecutor backs the optional-status-filtered, paginated GET
 * /api/v1/inventory/stock-takes - see StockTakeService#buildSessionSpecification.
 */
@Repository
public interface StockTakeSessionRepository extends JpaRepository<StockTakeSession, UUID>, JpaSpecificationExecutor<StockTakeSession> {

    Optional<StockTakeSession> findByIdAndDeletedFalse(UUID id);
}
