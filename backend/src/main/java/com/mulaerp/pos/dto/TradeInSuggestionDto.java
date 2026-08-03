package com.mulaerp.pos.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One ranked candidate returned by GET /api/v1/pos/trade-ins/suggest - see TradeInSuggestionService
 * for the matching and pricing rules. Deterministic and auditable by construction: no LLM/model
 * involved in any of the fields above {@code recentAcquisitions} - only Product.buyPrice/unitPrice,
 * the trade-in ledger, and the configured multipliers under {@code mulaerp.tradein.*}. Price is
 * NEVER touched by the optional AI reranker below.
 *
 * <h2>aiSuggested / aiMatch (optional local LLM reranker, product matching ONLY)</h2>
 * When {@code mulaerp.tradein.ai-match.enabled} is true (default false), {@code
 * com.mulaerp.ai.OllamaTradeInMatcher} may rerank which of these already-retrieved candidates best
 * matches the raw free-text query and parse condition/hasBox/accessories hints out of it - see that
 * class's javadoc for the validation/timeout/fail-soft rules. It can only ever point at a SKU
 * already present in this array (validated before {@code aiSuggested} is ever set) - it can never
 * introduce a product that wasn't retrieved by the deterministic search above, and it never changes
 * {@code suggestedCashOffer}/{@code suggestedCreditOffer}.
 *
 * <p><b>Response shape note:</b> the endpoint returns a bare JSON array (unchanged, for backward
 * compatibility with existing callers/tests that treat it as {@code Array<...>}), so there is no
 * top-level {@code aiMatch} sibling of the array itself - a JSON array cannot carry extra
 * non-index properties on the wire. Instead, {@code aiMatch} is carried on the one row the model
 * chose ({@code aiSuggested: true}); every other row - and every row at all when the feature is
 * disabled or the AI attempt didn't produce a validated match - has {@code aiSuggested} false/null
 * and {@code aiMatch} null.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TradeInSuggestionDto {
    private UUID productId;
    private String sku;
    private String name;
    private String categoryName;
    /** Product.buyPrice - what the shop advertises paying to acquire this item. Null if the
     * product has never had a buy price set (falls back to unitPrice for the pricing formula in
     * that case - see TradeInSuggestionService). */
    private BigDecimal listedBuyPrice;
    private BigDecimal unitPrice;
    private BigDecimal suggestedCashOffer;
    private BigDecimal suggestedCreditOffer;
    /** 0..1 - trigram similarity when pg_trgm is available, or a normalized word-overlap score
     * under the ILIKE fallback ranking (see TradeInSuggestionService for which was used). */
    private Double matchScore;
    private RecentAcquisitions recentAcquisitions;
    /** True only on the single row the optional AI reranker chose as the best match for the raw
     * query - see class javadoc. Null/false on every other row, and on every row whenever the
     * feature is disabled or didn't produce a validated match. */
    private Boolean aiSuggested;
    /** Present only alongside {@code aiSuggested: true} - see class javadoc. */
    private AiMatchInfo aiMatch;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentAcquisitions {
        private int count;
        private BigDecimal min;
        private BigDecimal median;
        private BigDecimal max;
    }

    /** Metadata about a validated AI reranker match - see TradeInSuggestionDto's class javadoc and
     * com.mulaerp.ai.OllamaTradeInMatcher. Never influences price. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiMatchInfo {
        private boolean applied;
        private String model;
        private Long latencyMs;
        private String suggestedSku;
        /** Best-effort parse of the free-text query, one of NEW/LIKE_NEW/GOOD/FAIR/POOR, or null -
         * not authoritative, the cashier can always override the Condition field. */
        private String parsedCondition;
        private Boolean parsedHasBox;
        private String parsedAccessories;
    }
}
