package com.mulaerp.shop.quote.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A postal/drop-off trade-in quote (WEBSHOP owner decision 3) - an INDICATIVE RANGE, never a firm
 * commitment, settled by staff inspection once the item physically arrives. See V41's migration
 * javadoc for the full column/constraint rationale and {@code
 * com.mulaerp.shop.quote.service.ShopTradeInQuoteService} for the pricing formula and every state
 * transition.
 *
 * <p><b>Members-only (OWNER DECISION, 2026-08):</b> a NEW quote must always have {@link
 * #shopCustomerId} populated - {@link #guestEmail}/{@link #guestName}/{@link #guestPhone} are no
 * longer written by {@code ShopTradeInQuoteService#requestQuote} for any row created from this
 * point forward (the guest-facing creation/lookup endpoints that used to populate them,
 * {@code PublicShopQuoteController}, were deleted, not just hidden). Those three columns are kept
 * on the entity/table SOLELY because pre-existing legacy rows (created before this change, mostly
 * test data from earlier verification passes) still reference them - see {@code
 * V43__close_legacy_guest_quotes.sql}'s javadoc for what happened to those rows and why the DB
 * CHECK below (which still allows either identity) was deliberately left unchanged rather than
 * tightened to a hard {@code NOT NULL}: a Postgres CHECK constraint validates the WHOLE row on
 * every UPDATE, not just INSERT, so a hard "shopCustomerId IS NOT NULL" constraint would also
 * reject staff's routine receive/inspect/complete/return actions on any still-existing legacy
 * null-customer row - breaking exactly the "must not crash on legacy rows" requirement this change
 * has to honour. Mandatory linkage for new rows is therefore enforced at the application layer only
 * (the service throws if ever asked to create a quote with no customer id; the sole remaining
 * caller, {@code ShopQuoteController}, is itself gated to {@code ROLE_SHOP_CUSTOMER} and always
 * supplies one).
 *
 * <p>Identity is either a registered shop customer ({@link #shopCustomerId}) or, for a legacy row
 * only, a guest ({@link #guestEmail}/{@link #guestName}/{@link #guestPhone}) - never neither (DB
 * CHECK, unchanged). The traded item is either an existing catalogue product ({@link #productId})
 * or a free-text description against a category ({@link #categoryId}) - never neither (DB CHECK).
 */
@Entity
@Table(name = "shop_trade_in_quotes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ShopTradeInQuote extends BaseEntity {

    /** Server-generated, e.g. "TQ-2026-000001-a1b2" - see ShopTradeInQuoteService#generateQuoteNumber. */
    @Column(name = "quote_number", nullable = false, unique = true, length = 40)
    private String quoteNumber;

    @Column(name = "shop_customer_id")
    private UUID shopCustomerId;

    /** LEGACY ONLY - see class javadoc "Members-only". Never populated for a quote created after
     * the members-only change; retained only because pre-existing legacy rows still reference it. */
    @Column(name = "guest_email")
    private String guestEmail;

    /** LEGACY ONLY - see {@link #guestEmail}. */
    @Column(name = "guest_name")
    private String guestName;

    /** LEGACY ONLY - see {@link #guestEmail}. */
    @Column(name = "guest_phone")
    private String guestPhone;

    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "free_text_description", columnDefinition = "TEXT")
    private String freeTextDescription;

    @Column(name = "category_id")
    private UUID categoryId;

    /** NEW|LIKE_NEW|GOOD|FAIR|POOR - same domain as Product.condition. */
    @Column(name = "declared_condition", nullable = false, length = 20)
    private String declaredCondition;

    @Column(name = "has_box")
    private Boolean hasBox;

    @Column(columnDefinition = "TEXT")
    private String accessories;

    @Column(name = "quoted_min", nullable = false, precision = 15, scale = 2)
    private BigDecimal quotedMin;

    @Column(name = "quoted_max", nullable = false, precision = 15, scale = 2)
    private BigDecimal quotedMax;

    @Column(name = "quoted_at", nullable = false)
    private LocalDateTime quotedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** POST or DROP_OFF. */
    @Column(name = "delivery_method", nullable = false, length = 20)
    private String deliveryMethod;

    /** QUOTED|EXPIRED|RECEIVED|INSPECTED|OFFER_MADE|ACCEPTED|DECLINED|RETURNED|COMPLETED - see
     * class javadoc / V41 for the full transition map. */
    @Column(nullable = false, length = 20)
    private String status = "QUOTED";

    @Column(name = "final_offer", precision = 15, scale = 2)
    private BigDecimal finalOffer;

    /** CASH or STORE_CREDIT - set alongside finalOffer at inspection. */
    @Column(name = "final_payout_type", length = 20)
    private String finalPayoutType;

    /** TRUE when finalOffer fell outside [quotedMin, quotedMax] - allowed, but recorded (see
     * ShopTradeInQuoteService#inspect, which requires inspectionNotes to carry a reason whenever
     * this is true). */
    @Column(name = "final_offer_out_of_range", nullable = false)
    private Boolean finalOfferOutOfRange = false;

    @Column(name = "inspection_notes", columnDefinition = "TEXT")
    private String inspectionNotes;

    @Column(name = "inspected_by")
    private String inspectedBy;

    @Column(name = "inspected_at")
    private LocalDateTime inspectedAt;

    /** Stamped when the customer accepts or declines the final offer. */
    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    /** Populated only once COMPLETED - links to the real PosTradeIn this quote resolved into. */
    @Column(name = "pos_trade_in_id")
    private UUID posTradeInId;

    public enum Status {
        QUOTED, EXPIRED, RECEIVED, INSPECTED, OFFER_MADE, ACCEPTED, DECLINED, RETURNED, COMPLETED
    }
}
