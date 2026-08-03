package com.mulaerp.pos.repository;

import com.mulaerp.pos.entity.PosTradeInLine;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * V38: line-level access to the trade-in ledger, for TradeInSuggestionService's recentAcquisitions
 * figure - {@code pos_trade_in_lines.payout_amount} is the reliable source of "what did we actually
 * pay to acquire this product via a trade-in" (stock_movements records quantity only, never a cost
 * amount - see StockMovement, which has no cost/value column at all).
 */
@Repository
public interface PosTradeInLineRepository extends JpaRepository<PosTradeInLine, UUID> {

    @Query("SELECT l FROM PosTradeInLine l WHERE l.productId = :productId AND l.deleted = false " +
            "ORDER BY l.createdAt DESC")
    List<PosTradeInLine> findRecentByProductId(@Param("productId") UUID productId, Pageable pageable);
}
