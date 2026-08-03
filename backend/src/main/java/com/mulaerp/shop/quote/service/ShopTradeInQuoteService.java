package com.mulaerp.shop.quote.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.pos.dto.CreatePosTradeInRequest;
import com.mulaerp.pos.service.PosTradeInService;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.entity.ProductCategory;
import com.mulaerp.product.repository.ProductCategoryRepository;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.shop.entity.ShopCustomer;
import com.mulaerp.shop.quote.dto.InspectQuoteRequest;
import com.mulaerp.shop.quote.dto.RequestTradeInQuoteRequest;
import com.mulaerp.shop.quote.dto.ShopTradeInQuoteDto;
import com.mulaerp.shop.quote.entity.ShopTradeInQuote;
import com.mulaerp.shop.quote.repository.ShopTradeInQuoteRepository;
import com.mulaerp.shop.repository.ShopCustomerRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Postal/drop-off trade-in quotes (WEBSHOP owner decision 3) - see V41's migration javadoc for the
 * schema and {@code ShopTradeInQuote}'s class javadoc for the identity/item invariants.
 *
 * <h2>Pricing - mirrors, does not call, TradeInSuggestionService</h2>
 * {@code quotedMax} is computed with the exact same formula
 * {@code com.mulaerp.pos.service.TradeInSuggestionService#computeSuggestedCashOffer} uses
 * (pricingBase x conditionMultiplier x (1 + boxBonus if hasBox), 2dp) - bound to the SAME
 * externalised {@code mulaerp.tradein.*} properties that service reads, not new magic numbers.
 * This is a deliberate MIRROR rather than a direct method call: {@code com.mulaerp.pos.**} is
 * outside this task's owned-files list (shop/quote/**, V41, application.yml quote keys, the e2e
 * spec) - reusing the same config keys keeps a single source of truth for the multipliers
 * themselves (change {@code TRADEIN_CONDITION_MULTIPLIER_GOOD} once, both services pick it up)
 * without touching a file this task doesn't own. {@code quotedMin} is {@code quotedMax} x {@code
 * mulaerp.shop.quote.min-factor} (default 0.7) - a configurable "how much worse could inspection
 * find this" floor, per the task's own suggested default.
 *
 * <h2>Pricing base when there is no catalogue product (free-text + category only)</h2>
 * Not specified by the task (which only describes the product-linked case in detail). This
 * implementation's choice, documented here: falls back to the average buyPrice (or unitPrice where
 * buyPrice is unset) of ACTIVE products already in the declared category - still fully
 * deterministic, no LLM/model involved. If the category has no priced products at all, quote
 * generation is rejected (400) rather than fabricating a number - the customer is asked to either
 * pick a specific catalogue item or contact staff for a manual quote.
 *
 * <h2>Expiry policy</h2>
 * See {@code ShopTradeInQuoteExpiryScheduler} - a QUOTED row past {@code expiresAt} flips to
 * EXPIRED. {@link #receive} and {@link #inspect} both reject (409) any quote not in the expected
 * status, which already covers "an EXPIRED quote cannot be received/inspected" - there is no
 * separate staff "re-quote" endpoint in this task's scope; the documented workaround is the
 * customer/guest simply submits a brand-new quote request.
 *
 * <h2>Out-of-range final offer policy (task item (g))</h2>
 * ALLOWED, not rejected - a real shop can reasonably offer less after seeing damage the
 * description/photos didn't show (or occasionally more). {@link #inspect} sets {@code
 * finalOfferOutOfRange} whenever {@code finalOffer} falls outside {@code [quotedMin, quotedMax]}
 * and REQUIRES non-blank {@code notes} in that case (400 otherwise) so the reason is always
 * recorded, never silent.
 *
 * <h2>Members-only (OWNER DECISION, superseding the guest path this class originally supported)</h2>
 * Online trade-in quote REQUESTS now require a {@code ROLE_SHOP_CUSTOMER} session - the previous
 * guest path ({@code POST /api/v1/public/shop/quotes}, {@code PublicShopQuoteController}, and this
 * method's own {@code guest}/{@code guestEmail}/{@code guestName}/{@code guestPhone} branch) has
 * been deleted, not merely hidden - staff still need to contact the seller and pay them, and a
 * guest quote that reached {@code OFFER_MADE} had no way to ever be accepted or declined (no
 * public accept/decline endpoint existed - see the now-removed {@code
 * shop-trade-in-declined.spec.ts} "DISCLOSED GAP" test, superseded by an assertion that guest quote
 * creation itself is refused). {@link #requestQuote} therefore now REQUIRES a non-null {@code
 * shopCustomerId} (throws {@link IllegalStateException}, 409, if ever called with {@code null} -
 * defensive; the only remaining caller, {@code ShopQuoteController}, always supplies one from the
 * authenticated session) and never populates {@code guestEmail}/{@code guestName}/{@code
 * guestPhone} on a new row. {@link #getForGuestLookup} has been removed entirely along with it.
 *
 * <h2>Legacy guest rows (pre-existing test data, V43)</h2>
 * Rows created under the old guest path before this change are NOT deleted (never delete data) and
 * NOT retrofitted with a {@code shopCustomerId} (there is no reliable way to attribute a guest
 * submission to a real account after the fact). See {@code V43__close_legacy_guest_quotes.sql}'s
 * javadoc for the exact policy chosen (closing out any still-open guest row to {@code EXPIRED},
 * since a guest quote could never legitimately reach {@code ACCEPTED}/{@code DECLINED}/{@code
 * COMPLETED}/{@code RETURNED} anyway) and why. Every staff admin action ({@link #receive}, {@link
 * #inspect}, {@link #complete}, {@link #returnItem}) and {@link #adminList}/{@link #toDto} already
 * tolerate a {@code null shopCustomerId} without any special-casing needed here - {@link
 * #resolveMemberId} already treats a null {@code shopCustomerId} as "no loyalty member, CASH only"
 * (see its own javadoc), which is exactly the same code path a still-open legacy guest row exercises
 * today; no new null-check was required to keep those endpoints from failing on such a row.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShopTradeInQuoteService {

    private static final Set<String> VALID_CONDITIONS = Set.of("NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR");
    private static final Set<String> VALID_DELIVERY_METHODS = Set.of("POST", "DROP_OFF");
    private static final Set<String> VALID_PAYOUT_TYPES = Set.of("CASH", "STORE_CREDIT");

    private final ShopTradeInQuoteRepository quoteRepository;
    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final ShopCustomerRepository shopCustomerRepository;
    private final PosTradeInService posTradeInService;

    @Value("${mulaerp.shop.quote.valid-days:7}")
    private int validDays;

    @Value("${mulaerp.shop.quote.min-factor:0.7}")
    private BigDecimal minFactor;

    // Mirrors TradeInSuggestionService's own @Value bindings - see class javadoc "Pricing" section.
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

    // =========================================================================================
    // Quote creation (ShopQuoteController only - members-only, see class javadoc)
    // =========================================================================================

    /** shopCustomerId is mandatory (OWNER DECISION - see class javadoc "Members-only") - the guest
     * path this method used to also support has been deleted. Throws if ever called with null;
     * defensive only, since the sole remaining caller (ShopQuoteController) always supplies the
     * authenticated session's customer id. */
    @Transactional
    public ShopTradeInQuoteDto requestQuote(RequestTradeInQuoteRequest request, UUID shopCustomerId) {
        if (shopCustomerId == null) {
            throw new IllegalStateException(
                    "A trade-in quote request must be linked to a signed-in shop customer account - "
                            + "sign in or register at /shop/register first");
        }
        if (request.getProductId() == null && request.getCategoryId() == null) {
            throw new IllegalArgumentException("Either productId or categoryId (with a free-text description) is required");
        }
        if (request.getProductId() == null && isBlank(request.getFreeTextDescription())) {
            throw new IllegalArgumentException("freeTextDescription is required when productId is not provided");
        }

        String condition = normalize(request.getDeclaredCondition());
        if (!VALID_CONDITIONS.contains(condition)) {
            throw new IllegalArgumentException("declaredCondition must be one of " + VALID_CONDITIONS);
        }
        String deliveryMethod = normalize(request.getDeliveryMethod());
        if (!VALID_DELIVERY_METHODS.contains(deliveryMethod)) {
            throw new IllegalArgumentException("deliveryMethod must be one of " + VALID_DELIVERY_METHODS);
        }

        Product product = null;
        if (request.getProductId() != null) {
            product = productRepository.findByIdAndDeletedFalse(request.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + request.getProductId()));
        }

        UUID categoryId = product != null
                ? (product.getCategory() != null ? product.getCategory().getId() : null)
                : request.getCategoryId();
        if (categoryId != null) {
            ProductCategory category = categoryRepository.findById(categoryId).orElse(null);
            if (category == null || Boolean.TRUE.equals(category.getDeleted())) {
                throw new ResourceNotFoundException("Category not found: " + categoryId);
            }
        }

        BigDecimal pricingBase = resolvePricingBase(product, categoryId);
        BigDecimal quotedMax = computeSuggestedCashOffer(pricingBase, condition, request.getHasBox());
        BigDecimal quotedMin = quotedMax.multiply(minFactor).setScale(2, RoundingMode.HALF_UP);
        if (quotedMin.compareTo(BigDecimal.ZERO) < 0) {
            quotedMin = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (quotedMin.compareTo(quotedMax) > 0) {
            // Defensive: a misconfigured min-factor > 1 must never produce min > max (violates the
            // DB CHECK too) - clamp rather than 500 on a bad deployment config.
            quotedMin = quotedMax;
        }

        LocalDateTime now = LocalDateTime.now();
        ShopTradeInQuote quote = new ShopTradeInQuote();
        quote.setQuoteNumber(generateQuoteNumber());
        quote.setShopCustomerId(shopCustomerId);
        // guestEmail/guestName/guestPhone are deliberately left null - never populated for a new
        // quote any more (see class javadoc "Members-only"). Those columns remain on the entity
        // only because legacy pre-existing rows still reference them.
        quote.setProductId(product != null ? product.getId() : null);
        quote.setFreeTextDescription(request.getFreeTextDescription());
        quote.setCategoryId(categoryId);
        quote.setDeclaredCondition(condition);
        quote.setHasBox(request.getHasBox());
        quote.setAccessories(request.getAccessories());
        quote.setQuotedMin(quotedMin);
        quote.setQuotedMax(quotedMax);
        quote.setQuotedAt(now);
        quote.setExpiresAt(now.plusDays(validDays));
        quote.setDeliveryMethod(deliveryMethod);
        quote.setStatus(ShopTradeInQuote.Status.QUOTED.name());

        return toDto(quoteRepository.save(quote));
    }

    private BigDecimal resolvePricingBase(Product product, UUID categoryId) {
        if (product != null) {
            return product.getBuyPrice() != null ? product.getBuyPrice() : product.getUnitPrice();
        }
        // See class javadoc "Pricing base when there is no catalogue product".
        Specification<Product> spec = (root, query, cb) -> {
            Predicate active = cb.and(cb.isFalse(root.get("deleted")), cb.equal(root.get("status"), "ACTIVE"));
            Predicate sameCategory = cb.equal(root.get("category").get("id"), categoryId);
            return cb.and(active, sameCategory);
        };
        List<BigDecimal> bases = productRepository.findAll(spec).stream()
                .map(p -> p.getBuyPrice() != null ? p.getBuyPrice() : p.getUnitPrice())
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (bases.isEmpty()) {
            throw new IllegalArgumentException(
                    "Cannot generate an indicative quote for this category - no priced catalogue items to base it on. "
                            + "Pick a specific catalogue item instead, or contact staff for a manual quote.");
        }
        BigDecimal sum = bases.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(bases.size()), 2, RoundingMode.HALF_UP);
    }

    /** Identical formula to TradeInSuggestionService#computeSuggestedCashOffer - see class javadoc. */
    private BigDecimal computeSuggestedCashOffer(BigDecimal pricingBase, String condition, Boolean hasBox) {
        BigDecimal base = pricingBase != null ? pricingBase : BigDecimal.ZERO;
        BigDecimal multiplier = conditionMultiplier(condition);
        BigDecimal boxMultiplier = Boolean.TRUE.equals(hasBox) ? BigDecimal.ONE.add(boxBonus) : BigDecimal.ONE;
        return base.multiply(multiplier).multiply(boxMultiplier).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal conditionMultiplier(String condition) {
        return switch (condition == null ? "" : condition) {
            case "LIKE_NEW" -> conditionMultiplierLikeNew;
            case "GOOD" -> conditionMultiplierGood;
            case "FAIR" -> conditionMultiplierFair;
            case "POOR" -> conditionMultiplierPoor;
            default -> conditionMultiplierNew;
        };
    }

    // =========================================================================================
    // Customer-facing reads/decisions (ShopQuoteController - SHOP_CUSTOMER only)
    // =========================================================================================

    @Transactional(readOnly = true)
    public Page<ShopTradeInQuoteDto> getOwnQuotes(UUID shopCustomerId, Pageable pageable) {
        return quoteRepository.findByShopCustomerIdAndDeletedFalse(shopCustomerId, pageable).map(this::toDto);
    }

    @Transactional
    public ShopTradeInQuoteDto acceptOffer(UUID id, UUID shopCustomerId) {
        ShopTradeInQuote quote = getOwnedByCustomer(id, shopCustomerId);
        requireStatus(quote, ShopTradeInQuote.Status.OFFER_MADE, "accepted");
        quote.setStatus(ShopTradeInQuote.Status.ACCEPTED.name());
        quote.setDecidedAt(LocalDateTime.now());
        return toDto(quoteRepository.save(quote));
    }

    @Transactional
    public ShopTradeInQuoteDto declineOffer(UUID id, UUID shopCustomerId) {
        ShopTradeInQuote quote = getOwnedByCustomer(id, shopCustomerId);
        requireStatus(quote, ShopTradeInQuote.Status.OFFER_MADE, "declined");
        quote.setStatus(ShopTradeInQuote.Status.DECLINED.name());
        quote.setDecidedAt(LocalDateTime.now());
        return toDto(quoteRepository.save(quote));
    }

    private ShopTradeInQuote getOwnedByCustomer(UUID id, UUID shopCustomerId) {
        ShopTradeInQuote quote = quoteRepository.findById(id)
                .filter(q -> !Boolean.TRUE.equals(q.getDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Quote not found: " + id));
        if (!Objects.equals(quote.getShopCustomerId(), shopCustomerId)) {
            throw new AccessDeniedException("This quote does not belong to you");
        }
        return quote;
    }

    // =========================================================================================
    // Staff admin (ShopAdminQuoteController)
    // =========================================================================================

    @Transactional(readOnly = true)
    public Page<ShopTradeInQuoteDto> adminList(String status, String deliveryMethod, Pageable pageable) {
        Specification<ShopTradeInQuote> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.trim().toUpperCase()));
            }
            if (deliveryMethod != null && !deliveryMethod.isBlank()) {
                predicates.add(cb.equal(root.get("deliveryMethod"), deliveryMethod.trim().toUpperCase()));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return quoteRepository.findAll(spec, pageable).map(this::toDto);
    }

    /** QUOTED -> RECEIVED (item physically arrived). Rejects (409) anything else, including
     * EXPIRED - see class javadoc "Expiry policy". */
    @Transactional
    public ShopTradeInQuoteDto receive(UUID id) {
        ShopTradeInQuote quote = getById(id);
        requireStatus(quote, ShopTradeInQuote.Status.QUOTED, "received");
        quote.setStatus(ShopTradeInQuote.Status.RECEIVED.name());
        return toDto(quoteRepository.save(quote));
    }

    /** RECEIVED -> OFFER_MADE. See class javadoc "Out-of-range final offer policy". */
    @Transactional
    public ShopTradeInQuoteDto inspect(UUID id, InspectQuoteRequest request) {
        ShopTradeInQuote quote = getById(id);
        requireStatus(quote, ShopTradeInQuote.Status.RECEIVED, "inspected");

        String payoutType = normalize(request.getPayoutType());
        if (!VALID_PAYOUT_TYPES.contains(payoutType)) {
            throw new IllegalArgumentException("payoutType must be one of " + VALID_PAYOUT_TYPES);
        }
        if ("STORE_CREDIT".equals(payoutType) && resolveMemberId(quote) == null) {
            throw new IllegalArgumentException(
                    "STORE_CREDIT requires a linked loyalty member - this quote's customer/guest has none; "
                            + "choose CASH, or link a loyalty account first");
        }

        boolean outOfRange = request.getFinalOffer().compareTo(quote.getQuotedMin()) < 0
                || request.getFinalOffer().compareTo(quote.getQuotedMax()) > 0;
        if (outOfRange && isBlank(request.getNotes())) {
            throw new IllegalArgumentException(
                    "notes is required, explaining the reason, when finalOffer falls outside the quoted range ["
                            + quote.getQuotedMin() + ", " + quote.getQuotedMax() + "]");
        }

        quote.setFinalOffer(request.getFinalOffer());
        quote.setFinalPayoutType(payoutType);
        quote.setFinalOfferOutOfRange(outOfRange);
        quote.setInspectionNotes(request.getNotes());
        quote.setInspectedBy(currentPrincipalName());
        quote.setInspectedAt(LocalDateTime.now());
        quote.setStatus(ShopTradeInQuote.Status.OFFER_MADE.name());
        return toDto(quoteRepository.save(quote));
    }

    /** ACCEPTED -> COMPLETED. Creates the REAL trade-in via the existing
     * PosTradeInService#createTradeIn - stock/TRADE_IN_RECEIPT movement, weighted-average
     * acquisitionCost, store-credit crediting, and the inventory journal all happen there. Never
     * reimplemented here. */
    @Transactional
    public ShopTradeInQuoteDto complete(UUID id) {
        ShopTradeInQuote quote = getById(id);
        requireStatus(quote, ShopTradeInQuote.Status.ACCEPTED, "completed");

        UUID memberId = resolveMemberId(quote);
        if ("STORE_CREDIT".equals(quote.getFinalPayoutType()) && memberId == null) {
            throw new IllegalStateException(
                    "STORE_CREDIT payout requires a linked loyalty member - none resolvable for this quote");
        }

        String description = quote.getProductId() != null
                ? productRepository.findById(quote.getProductId()).map(Product::getName).orElse("Trade-in item")
                : (quote.getFreeTextDescription() != null ? quote.getFreeTextDescription() : "Trade-in item");

        CreatePosTradeInRequest request = new CreatePosTradeInRequest();
        request.setClientTradeInId("QUOTE-" + quote.getQuoteNumber());
        request.setMemberId(memberId);
        request.setPayoutType(quote.getFinalPayoutType());

        CreatePosTradeInRequest.TradeInLineRequest line = new CreatePosTradeInRequest.TradeInLineRequest();
        line.setDescription(description);
        line.setCondition(quote.getDeclaredCondition());
        line.setAccessories(quote.getAccessories());
        line.setHasBox(quote.getHasBox());
        // Both offered values are set to the SAME finalOffer figure the staff recorded at
        // inspection - regardless of payoutType, the amount actually paid must be exactly what
        // was agreed, not TradeInSuggestionService's separate cash/credit tiers (those only ever
        // fed the ORIGINAL indicative range, not the post-inspection settlement).
        line.setOfferedCashValue(quote.getFinalOffer());
        line.setOfferedCreditValue(quote.getFinalOffer());
        line.setProductId(quote.getProductId());
        line.setCategoryId(quote.getProductId() == null ? quote.getCategoryId() : null);
        request.setLines(List.of(line));

        PosTradeInService.TradeInResult result = posTradeInService.createTradeIn(request);

        quote.setPosTradeInId(result.dto().getId());
        quote.setStatus(ShopTradeInQuote.Status.COMPLETED.name());
        return toDto(quoteRepository.save(quote));
    }

    /** DECLINED -> RETURNED (item physically handed back to the customer). No stock/journal
     * effect - the item never entered inventory. */
    @Transactional
    public ShopTradeInQuoteDto returnItem(UUID id) {
        ShopTradeInQuote quote = getById(id);
        requireStatus(quote, ShopTradeInQuote.Status.DECLINED, "returned");
        quote.setStatus(ShopTradeInQuote.Status.RETURNED.name());
        return toDto(quoteRepository.save(quote));
    }

    private UUID resolveMemberId(ShopTradeInQuote quote) {
        if (quote.getShopCustomerId() == null) {
            // Guest quote - no shop_customers row at all, so no possible loyalty member link.
            return null;
        }
        return shopCustomerRepository.findById(quote.getShopCustomerId())
                .filter(c -> !Boolean.TRUE.equals(c.getDeleted()))
                .map(ShopCustomer::getMemberId)
                .orElse(null);
    }

    private ShopTradeInQuote getById(UUID id) {
        return quoteRepository.findById(id)
                .filter(q -> !Boolean.TRUE.equals(q.getDeleted()))
                .orElseThrow(() -> new ResourceNotFoundException("Quote not found: " + id));
    }

    private void requireStatus(ShopTradeInQuote quote, ShopTradeInQuote.Status expected, String actionPastTense) {
        if (!expected.name().equals(quote.getStatus())) {
            throw new IllegalStateException("Only a quote with status " + expected.name() + " can be " + actionPastTense
                    + " (current status: " + quote.getStatus() + ")");
        }
    }

    private String currentPrincipalName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null ? authentication.getName() : "unknown";
    }

    private ShopTradeInQuoteDto toDto(ShopTradeInQuote quote) {
        String productName = quote.getProductId() != null
                ? productRepository.findById(quote.getProductId()).map(Product::getName).orElse(null)
                : null;
        String categoryName = quote.getCategoryId() != null
                ? categoryRepository.findById(quote.getCategoryId()).map(ProductCategory::getName).orElse(null)
                : null;
        return ShopTradeInQuoteDto.fromEntity(quote, productName, categoryName);
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toUpperCase();
    }

    // count()-based sequence has no locking, so two concurrent quote requests can read the same
    // count and produce the same number - append a random hex suffix so the number is unique by
    // construction even when that race happens (same pattern as PosTradeInService/PosSaleService).
    private String generateQuoteNumber() {
        String prefix = "TQ-" + LocalDate.now().getYear() + "-";
        long count = quoteRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }
}
