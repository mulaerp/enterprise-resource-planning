package com.mulaerp.pos.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One item accepted in a trade-in. Either LINKED to an already-existing catalogue product (the
 * cashier picked a GET /pos/trade-ins/suggest candidate, or passed productId directly) - in which
 * case that product's stock is incremented and its acquisitionCost becomes a weighted average (see
 * PosTradeInService#applyWeightedAverageAcquisitionCost) - or UNLINKED, in which case a brand-new
 * Product is created (condition/accessories/hasBox/acquisitionCost set from the line, categoryId
 * required, opening stock 1 via a TRADE_IN_RECEIPT movement - see PosTradeInService#receiveLines).
 * productId always ends up populated either way (the linked product's id, or the newly-created
 * one's) - see V38's migration comment for why the column is nevertheless nullable at the DB level.
 */
@Entity
@Table(name = "pos_trade_in_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PosTradeInLine extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_in_id", nullable = false)
    private PosTradeIn tradeIn;

    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false)
    private String description;

    @Column(length = 20)
    private String condition;

    @Column(columnDefinition = "TEXT")
    private String accessories;

    @Column(name = "has_box")
    private Boolean hasBox;

    @Column(name = "offered_cash_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal offeredCashValue = BigDecimal.ZERO;

    @Column(name = "offered_credit_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal offeredCreditValue = BigDecimal.ZERO;

    /** The value actually granted - offeredCashValue for a CASH payout, offeredCreditValue for
     * STORE_CREDIT or APPLIED_TO_SALE (the credit rate always applies to part-exchange, per the
     * approved design decision). Also feeds the resulting product's acquisitionCost (weighted
     * average for a linked product, direct set for a newly-created one). */
    @Column(name = "payout_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal payoutAmount = BigDecimal.ZERO;

    /** V38: the category assigned to whichever product this line resolved to - see the migration's
     * column comment. Nullable: enforced as required (for an unlinked line) in
     * PosTradeInService/CreatePosTradeInRequest, not at the DB layer. */
    @Column(name = "category_id")
    private UUID categoryId;

    /** V38: TRUE when productId points at a product that already existed before this trade-in
     * (a suggest-endpoint match) rather than one this line just created. Drives both the weighted-
     * average acquisitionCost update at receipt and the exact-restore reversal on void - see
     * PosTradeInService and PosSaleService#voidSale. */
    @Column(name = "linked_existing_product", nullable = false)
    private Boolean linkedExistingProduct = false;

    /** V38: the linked product's acquisitionCost immediately before this trade-in's weighted-
     * average update - NULL for an unlinked line, and NULL for a linked line whose product had no
     * acquisitionCost yet. See the migration's column comment for why this is stored rather than
     * recomputed on void. */
    @Column(name = "previous_acquisition_cost", precision = 15, scale = 2)
    private BigDecimal previousAcquisitionCost;
}
