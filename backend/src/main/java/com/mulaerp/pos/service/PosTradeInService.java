package com.mulaerp.pos.service;

import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.service.AccountingService;
import com.mulaerp.accounting.service.CashAccountResolver;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.member.service.MemberService;
import com.mulaerp.pos.dto.CreatePosTradeInRequest;
import com.mulaerp.pos.dto.PosTradeInDto;
import com.mulaerp.pos.entity.PosTradeIn;
import com.mulaerp.pos.entity.PosTradeInLine;
import com.mulaerp.pos.repository.PosTradeInRepository;
import com.mulaerp.product.dto.CreateProductRequest;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.product.service.ProductService;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Trade-in purchases of used goods from a customer. V38: each line is either LINKED to an
 * already-existing catalogue product (productId set on the request, typically a
 * GET /pos/trade-ins/suggest candidate the cashier picked) - in which case no new Product is
 * created, that product's stock gains +1 and its acquisitionCost becomes a weighted average (see
 * #applyWeightedAverageAcquisitionCost) - or UNLINKED, in which case a brand-new Product is created
 * (via the existing ProductService.createProduct path, categoryId now required) with opening stock
 * received through a TRADE_IN_RECEIPT movement (not the generic ADJUSTMENT movement createProduct
 * would otherwise write for a nonzero opening stock - see #receiveLines, which creates the product
 * with stockQuantity 0 and then applies the +1 itself so the ledger shows the trade-in-specific
 * movement type). Both paths write the same TRADE_IN_RECEIPT movement either way. Standalone
 * payouts (CASH/STORE_CREDIT) post a non-blocking draft journal entry mirroring PosSaleService's
 * pattern; APPLIED_TO_SALE (part-exchange) is created internally by PosSaleService, which folds the
 * trade-in's inventory value into the sale's own combined journal entry instead - see
 * #createEmbeddedForSale.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PosTradeInService {

    private static final Set<String> STANDALONE_PAYOUT_TYPES = Set.of("CASH", "STORE_CREDIT");

    private static final String INVENTORY_ACCOUNT_CODE = "1130";

    private final PosTradeInRepository posTradeInRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final MemberService memberService;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;
    private final StockMovementService stockMovementService;
    private final AccountingService accountingService;
    private final AccountRepository accountRepository;
    private final CashAccountResolver cashAccountResolver;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;

    @Transactional(readOnly = true)
    public Page<PosTradeInDto> getAllTradeIns(Pageable pageable) {
        Pageable newestFirst = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by("createdAt").descending());
        return posTradeInRepository.findAll(newestFirst).map(PosTradeInDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public PosTradeInDto getTradeInById(UUID id) {
        PosTradeIn tradeIn = posTradeInRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trade-in not found: " + id));
        return PosTradeInDto.fromEntity(tradeIn);
    }

    public record TradeInResult(PosTradeInDto dto, boolean created) {}

    /** Standalone payout - POST /api/v1/pos/trade-ins. payoutType must be CASH or STORE_CREDIT. */
    @Transactional
    public TradeInResult createTradeIn(CreatePosTradeInRequest request) {
        Optional<PosTradeIn> existing = posTradeInRepository.findByClientTradeInId(request.getClientTradeInId());
        if (existing.isPresent()) {
            return new TradeInResult(PosTradeInDto.fromEntity(existing.get()), false);
        }

        String payoutType = request.getPayoutType() == null ? "" : request.getPayoutType().trim().toUpperCase();
        if (!STANDALONE_PAYOUT_TYPES.contains(payoutType)) {
            throw new IllegalArgumentException("payoutType must be one of " + STANDALONE_PAYOUT_TYPES);
        }
        if ("STORE_CREDIT".equals(payoutType) && request.getMemberId() == null) {
            throw new IllegalArgumentException("memberId is required for a STORE_CREDIT payout");
        }

        PosTradeIn tradeIn = new PosTradeIn();
        tradeIn.setTradeInNumber(generateTradeInNumber());
        tradeIn.setClientTradeInId(request.getClientTradeInId());
        tradeIn.setMemberId(request.getMemberId());
        tradeIn.setPayoutType(payoutType);

        BigDecimal payoutTotal = receiveLines(tradeIn, request.getLines(), payoutType);
        tradeIn.setPayoutTotal(payoutTotal);

        PosTradeIn saved = posTradeInRepository.save(tradeIn);

        if ("STORE_CREDIT".equals(payoutType)) {
            memberService.creditStoreCredit(request.getMemberId(), payoutTotal);
        }

        postStandalonePayoutJournalEntry(saved, payoutType, payoutTotal);

        return new TradeInResult(PosTradeInDto.fromEntity(saved), true);
    }

    /**
     * Part-exchange - called from PosSaleService within the sale's own transaction. Never posts
     * its own journal entry (the sale folds the trade-in's inventory value into its own combined
     * entry - see PosSaleService); the caller is responsible for stamping posSaleId's own linkage
     * back once the sale is persisted (done here via the saleId parameter, safe because the sale
     * row itself only needs its own id, already known before the sale entity is saved further
     * down PosSaleService's flow... actually assigned up-front by the caller).
     *
     * <p>BUGFIX: {@code valuationType} (CASH or STORE_CREDIT, resolved by
     * PosSaleService#createSale from the request's trade-in payout dropdown selection) now drives
     * which offered value {@link #receiveLines} applies - previously this always passed
     * {@code APPLIED_TO_SALE.name()} through, which could never match receiveLines' own
     * {@code "CASH".equals(...)} check, so every part-exchange line silently used the credit rate
     * regardless of what the operator chose. The persisted trade-in's own {@code payoutType}
     * column stays {@code APPLIED_TO_SALE} (the record-type marker distinguishing it from a
     * standalone payout) - only the valuation math changes.
     */
    @Transactional
    public PosTradeIn createEmbeddedForSale(String clientTradeInId,
                                             List<CreatePosTradeInRequest.TradeInLineRequest> lines,
                                             UUID memberId, UUID saleId, String valuationType) {
        Optional<PosTradeIn> existing = posTradeInRepository.findByClientTradeInId(clientTradeInId);
        if (existing.isPresent()) {
            return existing.get();
        }

        PosTradeIn tradeIn = new PosTradeIn();
        tradeIn.setTradeInNumber(generateTradeInNumber());
        tradeIn.setClientTradeInId(clientTradeInId);
        tradeIn.setMemberId(memberId);
        tradeIn.setPosSaleId(saleId);
        tradeIn.setPayoutType(PosTradeIn.PayoutType.APPLIED_TO_SALE.name());

        BigDecimal payoutTotal = receiveLines(tradeIn, lines, valuationType);
        tradeIn.setPayoutTotal(payoutTotal);

        return posTradeInRepository.save(tradeIn);
    }

    /**
     * V38 - catalogue linkage: when the request line carries a productId (the cashier picked a
     * GET /pos/trade-ins/suggest candidate, or the caller passed one directly), NO new Product is
     * created - the existing product's stock is incremented by 1 and its acquisitionCost becomes a
     * weighted average (see {@link #applyWeightedAverageAcquisitionCost}) via the SAME
     * warehouse-stock + TRADE_IN_RECEIPT movement path unlinked lines already used. When productId
     * is absent, categoryId is now REQUIRED (thrown as IllegalArgumentException -> 400) so a
     * newly-minted product is never left uncategorised, and is assigned to the new product.
     * payoutAmount is offeredCashValue for a CASH payout, offeredCreditValue otherwise (STORE_CREDIT
     * or APPLIED_TO_SALE both use the credit rate, per the approved design decision).
     */
    private BigDecimal receiveLines(PosTradeIn tradeIn, List<CreatePosTradeInRequest.TradeInLineRequest> lineRequests,
                                     String payoutType) {
        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();
        BigDecimal payoutTotal = BigDecimal.ZERO;

        for (CreatePosTradeInRequest.TradeInLineRequest lineReq : lineRequests) {
            BigDecimal offeredCash = lineReq.getOfferedCashValue() != null ? lineReq.getOfferedCashValue() : BigDecimal.ZERO;
            BigDecimal offeredCredit = lineReq.getOfferedCreditValue() != null ? lineReq.getOfferedCreditValue() : BigDecimal.ZERO;
            BigDecimal payoutAmount = "CASH".equals(payoutType) ? offeredCash : offeredCredit;

            boolean linked = lineReq.getProductId() != null;
            Product product;
            UUID resolvedCategoryId;
            BigDecimal previousAcquisitionCost = null;

            if (linked) {
                product = productRepository.findByIdAndDeletedFalse(lineReq.getProductId())
                        .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + lineReq.getProductId()));
                previousAcquisitionCost = product.getAcquisitionCost();
                // Weighted average is computed off the pre-increment stockQuantity (see
                // #applyWeightedAverageAcquisitionCost's javadoc), so this must run BEFORE the +1
                // below - do not reorder.
                applyWeightedAverageAcquisitionCost(product, payoutAmount);
                resolvedCategoryId = product.getCategory() != null ? product.getCategory().getId() : null;
                product.setStockQuantity(product.getStockQuantity() + 1);
                productRepository.save(product);
            } else {
                if (lineReq.getCategoryId() == null) {
                    throw new IllegalArgumentException(
                            "categoryId is required for a trade-in line with no productId - every new item must land in a category");
                }

                CreateProductRequest productRequest = new CreateProductRequest();
                productRequest.setSku(generateTradeInSku(tradeIn.getTradeInNumber(), tradeIn.getLines().size() + 1));
                productRequest.setName(lineReq.getDescription());
                productRequest.setDescription(lineReq.getDescription());
                productRequest.setUnitPrice(payoutAmount);
                productRequest.setCostPrice(payoutAmount);
                productRequest.setStockQuantity(0);
                productRequest.setReorderLevel(0);
                productRequest.setStatus("ACTIVE");
                productRequest.setCondition(lineReq.getCondition());
                productRequest.setAcquisitionCost(payoutAmount);
                productRequest.setAccessories(lineReq.getAccessories());
                productRequest.setHasBox(lineReq.getHasBox());
                productRequest.setCategoryId(lineReq.getCategoryId());

                var createdDto = productService.createProduct(productRequest);
                product = productRepository.findById(createdDto.getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + createdDto.getId()));
                resolvedCategoryId = lineReq.getCategoryId();

                // Apply the opening stock of 1 ourselves (createProduct left it at 0) so the ledger
                // records TRADE_IN_RECEIPT, not the generic opening-stock ADJUSTMENT.
                product.setStockQuantity(product.getStockQuantity() + 1);
                productRepository.save(product);
            }

            warehouseStockService.applyDelta(mainWarehouseId, product, 1);
            productService.evictProductCache(product.getId());
            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.TRADE_IN_RECEIPT,
                    1, tradeIn.getTradeInNumber(), linked ? "Trade-in receipt (linked to existing product)" : "Trade-in receipt");

            PosTradeInLine line = new PosTradeInLine();
            line.setProductId(product.getId());
            line.setDescription(lineReq.getDescription());
            line.setCondition(lineReq.getCondition());
            line.setAccessories(lineReq.getAccessories());
            line.setHasBox(lineReq.getHasBox());
            line.setOfferedCashValue(offeredCash);
            line.setOfferedCreditValue(offeredCredit);
            line.setPayoutAmount(payoutAmount);
            line.setCategoryId(resolvedCategoryId);
            line.setLinkedExistingProduct(linked);
            line.setPreviousAcquisitionCost(linked ? previousAcquisitionCost : null);
            tradeIn.addLine(line);

            payoutTotal = payoutTotal.add(payoutAmount);
        }

        return payoutTotal;
    }

    /**
     * V38 - weighted-average acquisitionCost update for a LINKED trade-in line (the product already
     * exists and is simply gaining +1 unit of stock at a possibly different cost than its existing
     * stock was acquired at). product.acquisitionCost is the COGS snapshot copied onto a PoS sale
     * line at sale time (see PosSaleLine/PosSaleService) - overwriting it with just the new unit's
     * cost would silently distort the margin reported on every UNIT ALREADY in stock, and averaging
     * naively across "number of trade-ins" rather than "number of units" would be wrong the moment
     * a product's stock also moves through non-trade-in channels (PO receipt, manual adjustment).
     *
     * <p>Formula (all quantities as of immediately before this trade-in's own +1 is applied):
     * <pre>
     *   existingQty   = product.stockQuantity                     (0 if there is no prior stock)
     *   existingBasis = existingQty * (product.acquisitionCost or 0 if never set)
     *   newBasis      = existingBasis + (1 * payoutAmount)        (this trade-in's 1 new unit)
     *   newQty        = existingQty + 1
     *   newAcquisitionCost = round(newBasis / newQty, 2dp, HALF_UP)
     * </pre>
     * When existingQty is 0 (the product is currently out of stock, whether because it never had
     * stock or every prior unit has since sold/moved on), this collapses to exactly payoutAmount -
     * there is no old cost basis left to average against, so the new cost is simply what was just
     * paid. Mutates product.acquisitionCost in place; does NOT touch product.stockQuantity (the
     * caller applies the +1 itself, uniformly with the unlinked path, immediately after this call).
     */
    private void applyWeightedAverageAcquisitionCost(Product product, BigDecimal payoutAmount) {
        int existingQty = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
        BigDecimal existingUnitCost = product.getAcquisitionCost() != null ? product.getAcquisitionCost() : BigDecimal.ZERO;
        BigDecimal existingBasis = existingUnitCost.multiply(BigDecimal.valueOf(existingQty));
        BigDecimal newBasis = existingBasis.add(payoutAmount);
        int newQty = existingQty + 1;
        BigDecimal weightedAverage = newBasis.divide(BigDecimal.valueOf(newQty), 2, java.math.RoundingMode.HALF_UP);
        product.setAcquisitionCost(weightedAverage);
    }

    /**
     * Non-blocking draft journal entry for a standalone payout, mirroring PosSaleService's
     * pattern: Dr Inventory 1130 / Cr <resolved account> - CASH resolves to 1111 Cash on Hand,
     * STORE_CREDIT resolves to 2140 Store Credit Liability (see CashAccountResolver - the same
     * helper every other cash-leg posting site uses, rather than a hardcoded ternary here). Never
     * posted for APPLIED_TO_SALE (folded into the sale itself).
     */
    private void postStandalonePayoutJournalEntry(PosTradeIn tradeIn, String payoutType, BigDecimal payoutTotal) {
        if (payoutTotal == null || payoutTotal.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        try {
            String creditAccountCode = cashAccountResolver.resolveCode(payoutType);

            Optional<Account> inventory = accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE);
            Optional<Account> creditAccount = accountRepository.findByCodeAndDeletedFalse(creditAccountCode);
            if (inventory.isEmpty() || creditAccount.isEmpty()) {
                log.warn("Skipping auto-journal for trade-in {}: missing well-known account(s) {}/{}",
                        tradeIn.getTradeInNumber(), INVENTORY_ACCOUNT_CODE, creditAccountCode);
                return;
            }

            JournalEntryLineDTO debitLine = new JournalEntryLineDTO();
            debitLine.setAccountId(inventory.get().getId());
            debitLine.setDebit(payoutTotal);
            debitLine.setCredit(BigDecimal.ZERO);
            debitLine.setDescription("Inventory - Trade-in " + tradeIn.getTradeInNumber());

            JournalEntryLineDTO creditLine = new JournalEntryLineDTO();
            creditLine.setAccountId(creditAccount.get().getId());
            creditLine.setDebit(BigDecimal.ZERO);
            creditLine.setCredit(payoutTotal);
            creditLine.setDescription(creditAccount.get().getName() + " - Trade-in " + tradeIn.getTradeInNumber());

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Trade-in " + tradeIn.getTradeInNumber());
            entry.setReference(tradeIn.getTradeInNumber());
            entry.setLines(List.of(debitLine, creditLine));

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create auto-journal entry for trade-in {}: {}", tradeIn.getTradeInNumber(), e.getMessage());
        }
    }

    private String generateTradeInSku(String tradeInNumber, int lineIndex) {
        return "TI-" + tradeInNumber.replace("TI-", "") + "-" + lineIndex;
    }

    // count()-based sequence has no locking, so two concurrent trade-in creations can read the
    // same count and produce the same number - append a random hex suffix so the number is unique
    // by construction even when that race happens (same pattern as PosSaleService/RepairJobService).
    private String generateTradeInNumber() {
        String prefix = "TI-" + LocalDate.now().getYear() + "-";
        long count = posTradeInRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }
}
