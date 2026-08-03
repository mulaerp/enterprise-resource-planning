package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.StockTakeLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * JpaSpecificationExecutor backs the paginated, optional onlyVariances-filtered GET
 * /api/v1/inventory/stock-takes/{id}/lines - see StockTakeService#buildLineSpecification. A
 * session's lines are never loaded as a single unbounded list (a session can snapshot thousands
 * of products) - every read here is paginated or a plain count.
 */
@Repository
public interface StockTakeLineRepository extends JpaRepository<StockTakeLine, UUID>, JpaSpecificationExecutor<StockTakeLine> {

    Optional<StockTakeLine> findByIdAndSessionIdAndDeletedFalse(UUID id, UUID sessionId);

    long countBySessionIdAndDeletedFalse(UUID sessionId);

    long countBySessionIdAndCountedQuantityIsNotNullAndDeletedFalse(UUID sessionId);

    /**
     * "variance <> 0" in SQL excludes NULLs (an uncounted line has a null variance) as well as
     * exact zero, so this correctly counts only lines with a recorded, non-zero variance without
     * needing a separate null check.
     */
    long countBySessionIdAndVarianceNotAndDeletedFalse(UUID sessionId, Integer variance);

    /**
     * Used only by StockTakeService#approve, which must walk every non-zero-variance line to
     * create its RECOUNT adjustment - approval is a one-off admin action on a REVIEW session
     * (already capped by the session-open snapshot's own line-count cap), not a hot path, so an
     * unbounded list here is acceptable unlike the paginated UI-facing reads above.
     */
    List<StockTakeLine> findBySessionIdAndVarianceNotAndDeletedFalse(UUID sessionId, Integer variance);

    boolean existsBySessionIdAndDeletedFalse(UUID sessionId);
}
