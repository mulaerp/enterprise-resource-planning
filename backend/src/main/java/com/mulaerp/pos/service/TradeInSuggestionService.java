package com.mulaerp.pos.service;

import com.mulaerp.ai.OllamaTradeInMatcher;
import com.mulaerp.pos.dto.TradeInSuggestionDto;
import com.mulaerp.pos.entity.PosTradeInLine;
import com.mulaerp.pos.repository.PosTradeInLineRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.entity.ProductCategory;
import com.mulaerp.product.repository.ProductCategoryRepository;
import com.mulaerp.product.repository.ProductRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Backs GET /api/v1/pos/trade-ins/suggest - deterministic, non-LLM candidate search + pricing for
 * the register's Trade-In panel, so a cashier can link a trade-in line to an existing catalogue
 * product instead of always minting a new one-off Product (see PosTradeInService).
 *
 * <h2>Matching</h2>
 * Primary path is Postgres trigram similarity ({@code pg_trgm}, enabled by V38) against
 * {@code products.name}/{@code sku}, using the GIN index V38 also creates - {@link
 * ProductRepository#searchByTrigramSimilarity}. Availability is checked once (lazily, cached) via
 * {@link ProductRepository#isPgTrgmExtensionInstalled()} rather than assumed, since V38's
 * {@code CREATE EXTENSION} is itself best-effort. When the extension isn't available, {@link
 * #fallbackWordOverlapSearch} is used instead: an ILIKE query per query-word (any word matching
 * name or SKU is a DB-level candidate), ranked in Java by the fraction of query words each
 * candidate actually contains - documented here per the "must not silently fail" requirement rather
 * than left as an unranked ILIKE dump.
 *
 * <h2>Pricing (mulaerp.tradein.* in application.yml - all configurable, documented there)</h2>
 * <pre>
 *   suggestedCashOffer   = listedBuyPrice x conditionMultiplier x (1 + boxBonus if hasBox), 2dp
 *   suggestedCreditOffer = suggestedCashOffer x creditPremium, clamped to never exceed unitPrice
 *                          (never offer more store credit than the item sells for), 2dp
 * </pre>
 * conditionMultiplier defaults: NEW 1.00, LIKE_NEW 0.95, GOOD 0.85, FAIR 0.70, POOR 0.50 - an
 * unrecognised/absent condition is treated as NEW-equivalent (1.00), documented rather than
 * defaulted silently to some other value. Deliberately deterministic and repeatable: nothing here
 * calls an LLM or any non-reproducible model - the same inputs (listedBuyPrice, condition, hasBox,
 * config) always produce the same offer, which is what makes the number explainable to a customer
 * and auditable after the fact.
 *
 * <h2>recentAcquisitions</h2>
 * Sourced from {@code pos_trade_in_lines.payout_amount} (via {@link PosTradeInLineRepository}), NOT
 * {@code stock_movements} - the movement ledger records quantity deltas only and has no cost/value
 * column at all (see {@code StockMovement}), so the trade-in line table is the only reliable record
 * of "what did we actually pay for this product via a trade-in" ({@code product.acquisitionCost} is
 * a live weighted average, not a history).
 *
 * <h2>Optional AI reranker (product matching ONLY, never pricing)</h2>
 * After the deterministic candidates above are built (including their {@code suggestedCashOffer}/
 * {@code suggestedCreditOffer}, computed exactly as before), {@link OllamaTradeInMatcher} gets one
 * chance to rerank which candidate best matches the raw free-text query and to parse condition/
 * hasBox/accessories hints out of it - see that class's javadoc for the disabled-by-default,
 * off-list-SKU-rejection, and fail-soft-on-any-error rules it enforces. It marks at most one
 * existing row ({@code aiSuggested: true} + {@code aiMatch}) and never adds, removes, reorders, or
 * re-prices anything in this list - see the "Response shape note" on {@link TradeInSuggestionDto}
 * for why the AI metadata rides on that one row rather than a top-level sibling of the array.
 */
@Service
@Slf4j
public class TradeInSuggestionService {

    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final PosTradeInLineRepository posTradeInLineRepository;
    private final OllamaTradeInMatcher aiMatcher;

    @Value("${mulaerp.tradein.condition-multiplier-new:1.00}")
    private BigDecimal conditionMultiplierNew;
    @Value("${mulaerp.tradein.condition-multiplier-like-new:0.95}")
    private BigDecimal conditionMultiplierLikeNew;
    @Value("${mulaerp.tradein.condition-multiplier-good:0.85}")
    private BigDecimal conditionMultiplierGood;
    @Value("${mulaerp.tradein.condition-multiplier-fair:0.70}")
    private BigDecimal conditionMultiplierFair;
    @Value("${mulaerp.tradein.condition-multiplier-poor:0.50}")
    private BigDecimal conditionMultiplierPoor;
    @Value("${mulaerp.tradein.box-bonus:0.05}")
    private BigDecimal boxBonus;
    @Value("${mulaerp.tradein.credit-premium:1.20}")
    private BigDecimal creditPremium;
    @Value("${mulaerp.tradein.suggest-max-results:8}")
    private int suggestMaxResults;
    @Value("${mulaerp.tradein.suggest-recent-acquisitions-count:5}")
    private int suggestRecentAcquisitionsCount;
    @Value("${mulaerp.tradein.suggest-min-trigram-similarity:0.05}")
    private double minTrigramSimilarity;

    private volatile Boolean pgTrgmAvailable;

    public TradeInSuggestionService(ProductRepository productRepository, ProductCategoryRepository categoryRepository,
                                     PosTradeInLineRepository posTradeInLineRepository, OllamaTradeInMatcher aiMatcher) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.posTradeInLineRepository = posTradeInLineRepository;
        this.aiMatcher = aiMatcher;
    }

    /** One candidate row, whichever search path produced it - a common shape so #toDto doesn't
     * need to know which ranking strategy found this product. */
    private record Candidate(UUID productId, String sku, String name, UUID categoryId,
                              BigDecimal unitPrice, BigDecimal buyPrice, double score) {
    }

    /**
     * NOTE on the {@code @Transactional} below + the optional AI step at the end: when {@code
     * mulaerp.tradein.ai-match.enabled} is true, the (bounded, {@code timeout-ms}-capped) Ollama
     * call happens inside this same read-only transaction, so a checked-out DB connection is held
     * for up to that long on a match attempt. Deliberate simplification for this optional,
     * off-by-default, single-shop-counter-box feature - correctness (no self-invocation /
     * transactional-proxy pitfalls from splitting this method) outweighs the minor connection-pool
     * pressure here. Revisit if this ever needs to scale past one box.
     */
    @Transactional(readOnly = true)
    public List<TradeInSuggestionDto> suggest(String q, String condition, Boolean hasBox) {
        if (q == null || q.trim().isEmpty()) {
            return List.of();
        }
        String trimmed = q.trim();

        List<Candidate> candidates = isPgTrgmAvailable()
                ? trigramSearch(trimmed)
                : fallbackWordOverlapSearch(trimmed);

        if (candidates.isEmpty()) {
            return List.of();
        }

        Map<UUID, String> categoryNames = resolveCategoryNames(candidates);

        // PRE-EXISTING BUG FIX (found while verifying the AI reranker below, unrelated to it - this
        // exact lookup existed before this class had any AI code): candidates.categoryId() is null
        // for any product without a category, and whenever EVERY retrieved candidate lacks one,
        // resolveCategoryNames returns Map.of() - whose .get() throws NPE on a null key by design
        // (JDK immutable collections reject null outright, even as a lookup argument), 500-ing the
        // whole endpoint. Guarding the lookup itself (rather than relying on which Map
        // implementation resolveCategoryNames happens to return) is the direct fix.
        List<TradeInSuggestionDto> dtos = candidates.stream()
                .map(c -> toDto(c, c.categoryId() != null ? categoryNames.get(c.categoryId()) : null, condition, hasBox))
                .collect(Collectors.toList());

        applyAiRerank(trimmed, dtos);

        return dtos;
    }

    /**
     * Optional reranker step - see {@link OllamaTradeInMatcher}'s javadoc for every safety rule it
     * enforces (disabled-by-default, off-list-SKU rejection, fail-soft on any error/timeout). This
     * method only ever mutates the {@code aiSuggested}/{@code aiMatch} fields of ONE existing
     * element of {@code dtos} - it never adds, removes, reorders, or touches price fields.
     */
    private void applyAiRerank(String query, List<TradeInSuggestionDto> dtos) {
        List<OllamaTradeInMatcher.Candidate> refs = dtos.stream()
                .map(d -> new OllamaTradeInMatcher.Candidate(d.getSku(), d.getName()))
                .collect(Collectors.toList());

        OllamaTradeInMatcher.Outcome outcome = aiMatcher.tryMatch(query, refs);
        if (outcome == null || !outcome.applied()) {
            return;
        }

        dtos.stream()
                .filter(d -> outcome.suggestedSku().equals(d.getSku()))
                .findFirst()
                .ifPresent(d -> {
                    d.setAiSuggested(true);
                    d.setAiMatch(new TradeInSuggestionDto.AiMatchInfo(
                            true, outcome.model(), outcome.latencyMs(), outcome.suggestedSku(),
                            outcome.parsedCondition(), outcome.parsedHasBox(), outcome.parsedAccessories()));
                });
    }

    private boolean isPgTrgmAvailable() {
        Boolean cached = pgTrgmAvailable;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (pgTrgmAvailable == null) {
                try {
                    pgTrgmAvailable = productRepository.isPgTrgmExtensionInstalled();
                } catch (Exception e) {
                    log.warn("Could not check pg_trgm availability - falling back to ILIKE/word-overlap ranking for trade-in suggest: {}",
                            e.getMessage());
                    pgTrgmAvailable = false;
                }
            }
            return pgTrgmAvailable;
        }
    }

    private List<Candidate> trigramSearch(String q) {
        return productRepository.searchByTrigramSimilarity(q, minTrigramSimilarity, suggestMaxResults).stream()
                .map(m -> new Candidate(m.getId(), m.getSku(), m.getName(), m.getCategoryId(),
                        m.getUnitPrice(), m.getBuyPrice(), m.getScore() != null ? m.getScore() : 0.0))
                .collect(Collectors.toList());
    }

    /**
     * Fallback ranking used only when pg_trgm is unavailable (see class javadoc). Splits the query
     * into words, fetches every active product matching ANY word (ILIKE on name/sku - a DB-level
     * OR, cheap without a trigram index), then ranks in Java by the fraction of query words each
     * candidate's name/sku actually contains (case-insensitive substring match) - a simple,
     * dependency-free stand-in for trigram similarity, documented rather than left as an unranked
     * ILIKE dump. Ties break by shorter product name first (a tighter match for the same word hits).
     */
    private List<Candidate> fallbackWordOverlapSearch(String q) {
        List<String> words = Arrays.stream(q.toLowerCase().split("\\s+"))
                .filter(w -> !w.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (words.isEmpty()) {
            return List.of();
        }

        Specification<Product> spec = (root, query, cb) -> {
            Predicate active = cb.and(cb.isFalse(root.get("deleted")), cb.equal(root.get("status"), "ACTIVE"));
            List<Predicate> wordPredicates = new ArrayList<>();
            for (String w : words) {
                String like = "%" + w + "%";
                wordPredicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("sku")), like)));
            }
            return cb.and(active, cb.or(wordPredicates.toArray(new Predicate[0])));
        };

        // Bounded candidate pool (generously larger than suggestMaxResults, so ranking has enough
        // to choose from) - the DB-level filter is intentionally loose (any word), Java does the
        // real ranking below.
        Pageable pool = PageRequest.of(0, Math.max(50, suggestMaxResults * 5), Sort.by("name").ascending());

        return productRepository.findAll(spec, pool).stream()
                .map(p -> {
                    String haystack = ((p.getName() == null ? "" : p.getName()) + " " + (p.getSku() == null ? "" : p.getSku()))
                            .toLowerCase();
                    long matched = words.stream().filter(haystack::contains).count();
                    double score = matched / (double) words.size();
                    UUID categoryId = p.getCategory() != null ? p.getCategory().getId() : null;
                    return new Candidate(p.getId(), p.getSku(), p.getName(), categoryId,
                            p.getUnitPrice(), p.getBuyPrice(), score);
                })
                .filter(c -> c.score() > 0)
                .sorted(Comparator.comparingDouble(Candidate::score).reversed()
                        .thenComparing(c -> c.name() == null ? "" : c.name(), Comparator.comparingInt(String::length)))
                .limit(suggestMaxResults)
                .collect(Collectors.toList());
    }

    private Map<UUID, String> resolveCategoryNames(List<Candidate> candidates) {
        List<UUID> categoryIds = candidates.stream()
                .map(Candidate::categoryId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (categoryIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> names = new HashMap<>();
        for (ProductCategory category : categoryRepository.findAllById(categoryIds)) {
            names.put(category.getId(), category.getName());
        }
        return names;
    }

    private TradeInSuggestionDto toDto(Candidate c, String categoryName, String condition, Boolean hasBox) {
        BigDecimal listedBuyPrice = c.buyPrice();
        // A product with no buyPrice set has never had a storefront "we buy this for" figure - fall
        // back to unitPrice so the suggestion is still a usable starting point rather than RM0,
        // documented here rather than silently offering nothing.
        BigDecimal pricingBase = listedBuyPrice != null ? listedBuyPrice : c.unitPrice();

        BigDecimal cashOffer = computeSuggestedCashOffer(pricingBase, condition, hasBox);
        BigDecimal creditOffer = computeSuggestedCreditOffer(cashOffer, c.unitPrice());

        TradeInSuggestionDto dto = new TradeInSuggestionDto();
        dto.setProductId(c.productId());
        dto.setSku(c.sku());
        dto.setName(c.name());
        dto.setCategoryName(categoryName);
        dto.setListedBuyPrice(listedBuyPrice);
        dto.setUnitPrice(c.unitPrice());
        dto.setSuggestedCashOffer(cashOffer);
        dto.setSuggestedCreditOffer(creditOffer);
        dto.setMatchScore(c.score());
        dto.setRecentAcquisitions(recentAcquisitions(c.productId()));
        return dto;
    }

    /** See class javadoc for the formula. */
    private BigDecimal computeSuggestedCashOffer(BigDecimal pricingBase, String condition, Boolean hasBox) {
        BigDecimal base = pricingBase != null ? pricingBase : BigDecimal.ZERO;
        BigDecimal multiplier = conditionMultiplier(condition);
        BigDecimal boxMultiplier = Boolean.TRUE.equals(hasBox) ? BigDecimal.ONE.add(boxBonus) : BigDecimal.ONE;
        return base.multiply(multiplier).multiply(boxMultiplier).setScale(2, RoundingMode.HALF_UP);
    }

    /** See class javadoc for the formula, incl. the never-above-unitPrice clamp. */
    private BigDecimal computeSuggestedCreditOffer(BigDecimal cashOffer, BigDecimal unitPrice) {
        BigDecimal credit = cashOffer.multiply(creditPremium).setScale(2, RoundingMode.HALF_UP);
        if (unitPrice != null && credit.compareTo(unitPrice) > 0) {
            return unitPrice.setScale(2, RoundingMode.HALF_UP);
        }
        return credit;
    }

    private BigDecimal conditionMultiplier(String condition) {
        String normalized = condition == null ? "" : condition.trim().toUpperCase();
        return switch (normalized) {
            case "LIKE_NEW" -> conditionMultiplierLikeNew;
            case "GOOD" -> conditionMultiplierGood;
            case "FAIR" -> conditionMultiplierFair;
            case "POOR" -> conditionMultiplierPoor;
            // "NEW", blank, or anything unrecognised - documented in the class javadoc.
            default -> conditionMultiplierNew;
        };
    }

    private TradeInSuggestionDto.RecentAcquisitions recentAcquisitions(UUID productId) {
        List<BigDecimal> costs = posTradeInLineRepository
                .findRecentByProductId(productId, PageRequest.of(0, suggestRecentAcquisitionsCount))
                .stream()
                .map(PosTradeInLine::getPayoutAmount)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());

        if (costs.isEmpty()) {
            return new TradeInSuggestionDto.RecentAcquisitions(0, null, null, null);
        }

        BigDecimal min = costs.get(0);
        BigDecimal max = costs.get(costs.size() - 1);
        BigDecimal median = median(costs);
        return new TradeInSuggestionDto.RecentAcquisitions(costs.size(), min, median, max);
    }

    private BigDecimal median(List<BigDecimal> sortedAscending) {
        int n = sortedAscending.size();
        if (n % 2 == 1) {
            return sortedAscending.get(n / 2);
        }
        BigDecimal lower = sortedAscending.get(n / 2 - 1);
        BigDecimal upper = sortedAscending.get(n / 2);
        return lower.add(upper).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
    }
}
