package com.mulaerp.pos.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A trade-in purchase of used goods from a customer - either paid out standalone (CASH or
 * STORE_CREDIT) or applied as part-exchange against a PoS sale (APPLIED_TO_SALE, in which case
 * {@code posSaleId} links back to that sale). {@code clientTradeInId} is the idempotency key
 * (mirrors PosSale#clientSaleId) so an offline-register retry never double-creates products or
 * double-posts a journal entry.
 */
@Entity
@Table(name = "pos_trade_ins")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PosTradeIn extends BaseEntity {

    /** Server-generated, e.g. "TI-2026-000001-a1b2". */
    @Column(name = "trade_in_number", nullable = false, unique = true, length = 30)
    private String tradeInNumber;

    /** Client-generated idempotency key - see class Javadoc. */
    @Column(name = "client_trade_in_id", nullable = false, unique = true, length = 100)
    private String clientTradeInId;

    @Column(name = "member_id")
    private UUID memberId;

    /** Set only when payoutType == APPLIED_TO_SALE - the sale this trade-in was applied to. */
    @Column(name = "pos_sale_id")
    private UUID posSaleId;

    @Column(name = "payout_type", nullable = false, length = 20)
    private String payoutType;

    @Column(name = "payout_total", nullable = false, precision = 15, scale = 2)
    private BigDecimal payoutTotal = BigDecimal.ZERO;

    // --- Void (V36) -------------------------------------------------------------------------
    /** ACTIVE or VOIDED - see PosSaleService#voidSale. Set VOIDED (never deleted - same
     * append-only philosophy as PosSale#status) when the sale this trade-in was applied to
     * (posSaleId) is voided and its traded-in item's stock receipt is reversed. A standalone
     * trade-in (posSaleId null) has no reversal path today and stays ACTIVE forever. */
    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @OneToMany(mappedBy = "tradeIn", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PosTradeInLine> lines = new ArrayList<>();

    public void addLine(PosTradeInLine line) {
        lines.add(line);
        line.setTradeIn(this);
    }

    public enum PayoutType {
        CASH,
        STORE_CREDIT,
        APPLIED_TO_SALE
    }
}
