package com.mulaerp.oversight.repository;

import com.mulaerp.pos.entity.PosTradeIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** OVERSIGHT: read-only secondary repository over {@link PosTradeIn} - see OversightPosSaleRepository javadoc. */
@Repository
public interface OversightPosTradeInRepository extends JpaRepository<PosTradeIn, UUID> {

    Optional<PosTradeIn> findByTradeInNumberAndDeletedFalse(String tradeInNumber);

    List<PosTradeIn> findByCreatedAtBetweenAndDeletedFalse(LocalDateTime from, LocalDateTime to);

    /** MY-DAY: a single cashier's trade-ins (standalone + part-exchange) for a day - see
     * MyDayService javadoc. */
    List<PosTradeIn> findByCreatedAtBetweenAndCreatedByAndDeletedFalse(LocalDateTime from, LocalDateTime to, String createdBy);
}
