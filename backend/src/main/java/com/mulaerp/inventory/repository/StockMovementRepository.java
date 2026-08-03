package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

/**
 * WP7: JpaSpecificationExecutor backs the multi-filter GET /api/v1/inventory/movements
 * (productId / movementType / startDate / endDate all optional) - same house pattern as
 * AuditLogRepository / BankTransactionRepository (a hand-written JPQL query with
 * "(:param IS NULL OR field = :param)" placeholders can't be used here: Postgres can't infer the
 * type of an untyped NULL bound against a typed column).
 */
@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, UUID>,
        JpaSpecificationExecutor<StockMovement> {

    @Query("SELECT COALESCE(SUM(m.quantityDelta), 0) FROM StockMovement m WHERE m.product.id = :productId")
    int sumQuantityDeltaByProductId(@Param("productId") UUID productId);

    long countByProduct_Id(UUID productId);

    Optional<StockMovement> findFirstByProduct_IdOrderByCreatedAtAsc(UUID productId);

    /**
     * V36: part-exchange void safety check - a traded-in product that has ever had one of these
     * "stock left the building/was consumed" movement types recorded against it has been resold,
     * consumed as a repair part, or transferred away since it was received, so its stock is no
     * longer purely "the item the customer traded in" even if a later top-up brought the raw
     * quantity back up to (or above) what was originally received - see PosSaleService#voidSale.
     */
    boolean existsByProduct_IdAndMovementTypeIn(UUID productId, Collection<StockMovement.MovementType> movementTypes);
}
