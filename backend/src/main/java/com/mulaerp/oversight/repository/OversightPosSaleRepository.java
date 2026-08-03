package com.mulaerp.oversight.repository;

import com.mulaerp.pos.entity.PosSale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * OVERSIGHT: a second, read-only Spring Data repository over {@link PosSale} - Spring Data JPA
 * supports multiple repository interfaces bound to the same entity, which lets the oversight
 * module query PoS sales by document number / date range without editing
 * {@code com.mulaerp.pos.repository.PosSaleRepository} (kept read-only, per the module boundary
 * for this work package). Every query here is a plain derived query - no writes, no business
 * logic.
 */
@Repository
public interface OversightPosSaleRepository extends JpaRepository<PosSale, UUID> {

    Optional<PosSale> findBySaleNumberAndDeletedFalse(String saleNumber);

    List<PosSale> findByCreatedAtBetweenAndDeletedFalse(LocalDateTime from, LocalDateTime to);

    /** V34: money-flow/exceptions "live" sections must exclude voided sales from takings/COGS/
     * margin/discount-abuse analysis - a reversed sale never happened as far as the till or the
     * books are concerned. */
    List<PosSale> findByCreatedAtBetweenAndStatusAndDeletedFalse(LocalDateTime from, LocalDateTime to, String status);

    /** V34: the oversight exceptions "Voided sales" section - every sale voided within the period
     * (voidedAt, not createdAt - a sale made last month but voided today belongs in today's report). */
    List<PosSale> findByStatusAndVoidedAtBetween(String status, LocalDateTime from, LocalDateTime to);

    /** MY-DAY: a single cashier's sales for a day, ANY status (COMPLETED and VOIDED alike) - unlike
     * the money-flow/exceptions "live" queries above, MyDayService needs both: COMPLETED sales
     * drive every takings figure, while a VOIDED one (originally rung up by this cashier, then
     * voided by a manager) still needs to surface in the drill-down list and the voidedSales
     * count/value - see MyDayService javadoc. */
    List<PosSale> findByCreatedAtBetweenAndCreatedByAndDeletedFalse(LocalDateTime from, LocalDateTime to, String createdBy);
}
