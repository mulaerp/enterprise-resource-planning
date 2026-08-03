package com.mulaerp.oversight.repository;

import com.mulaerp.pos.entity.PosTradeInLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** OVERSIGHT: read-only secondary repository over {@link PosTradeInLine} - see OversightPosSaleRepository javadoc. */
@Repository
public interface OversightPosTradeInLineRepository extends JpaRepository<PosTradeInLine, UUID> {

    List<PosTradeInLine> findByProductIdOrderByCreatedAtAsc(UUID productId);
}
