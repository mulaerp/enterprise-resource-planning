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
import com.mulaerp.inventory.repository.StockMovementRepository;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.member.entity.Member;
import com.mulaerp.member.service.MemberService;
import com.mulaerp.pos.dto.CreatePosSaleRequest;
import com.mulaerp.pos.dto.CreatePosTradeInRequest;
import com.mulaerp.pos.dto.PosSaleDto;
import com.mulaerp.pos.dto.PosSaleLineDto;
import com.mulaerp.pos.dto.VoidPosSaleResponseDto;
import com.mulaerp.pos.entity.PosSale;
import com.mulaerp.pos.entity.PosSaleLine;
import com.mulaerp.pos.entity.PosTradeIn;
import com.mulaerp.pos.entity.PosTradeInLine;
import com.mulaerp.pos.repository.PosSaleRepository;
import com.mulaerp.pos.repository.PosTradeInRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.product.service.ProductService;
import com.mulaerp.voucher.service.VoucherService;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import com.mulaerp.warranty.service.WarrantyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Orchestrates thrift-store PoS sales: idempotent creation, stock decrement (Product total +
 * warehouse_stock MAIN breakdown), member discount/points/tier, voucher redemption, and the
 * non-blocking auto-journal hooks - mirrors InvoiceService#createInvoiceJournalEntry (WP4a).
 *
 * <p>CRITICAL FIX 2 (post-overhaul audit): every line's client-supplied unitPrice is validated
 * against the product's current unitPrice (see {@link #priceFloor}) - thrift-store staff DO
 * negotiate prices down, so a markdown is always allowed, but only down to a floor
 * (max(costPrice, acquisitionCost) when either is set on the product, else
 * mulaerp.pos.max-discount-percent below list price) and never above list price. lineDiscount and
 * cartDiscount get the same treatment so neither can be abused to take the effective line/cart
 * total below that same floor.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PosSaleService {

    private static final Set<String> ALLOWED_PAYMENT_METHODS = Set.of("CASH", "CARD", "EWALLET", "STORE_CREDIT");

    /** BUGFIX: valid values for {@link CreatePosSaleRequest.TradeInRequest#getPayoutType()} - see
     * {@link #resolveTradeInPayoutType}. */
    private static final Set<String> TRADE_IN_VALUATION_TYPES = Set.of("CASH", "STORE_CREDIT");

    private static final String SALES_REVENUE_ACCOUNT_CODE = "4100";
    private static final String COGS_ACCOUNT_CODE = "5100";
    private static final String INVENTORY_ACCOUNT_CODE = "1130";

    private final PosSaleRepository posSaleRepository;
    private final PosTradeInRepository posTradeInRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final MemberService memberService;
    private final VoucherService voucherService;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;
    private final AccountingService accountingService;
    private final AccountRepository accountRepository;
    private final CashAccountResolver cashAccountResolver;
    private final StockMovementService stockMovementService;
    private final StockMovementRepository stockMovementRepository;
    private final WarrantyService warrantyService;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;
    private final PosTradeInService posTradeInService;

    /** V36: a traded-in product that has ever had one of these movement types recorded against it
     * has left the building (sold, consumed as a repair part, or transferred away) since it was
     * received - see #voidSale's part-exchange safety check. */
    private static final Set<StockMovement.MovementType> TRADE_IN_CONSUMING_MOVEMENT_TYPES = Set.of(
            StockMovement.MovementType.POS_SALE,
            StockMovement.MovementType.SO_DELIVERY,
            StockMovement.MovementType.REPAIR_PART_CONSUMED,
            StockMovement.MovementType.TRANSFER_OUT
    );

    private static final String TRADE_IN_STATUS_VOIDED = "VOIDED";

    @Value("${mulaerp.pos.max-discount-percent:50}")
    private int maxDiscountPercent;

    /** V34: how many days after a sale it may still be voided - see #voidSale. */
    @Value("${mulaerp.pos.void-window-days:7}")
    private int voidWindowDays;

    private static final String STATUS_VOIDED = "VOIDED";

    @Transactional(readOnly = true)
    public Page<PosSaleDto> getAllSales(Pageable pageable) {
        Pageable newestFirst = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                Sort.by("createdAt").descending());
        return posSaleRepository.findAll(newestFirst).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public PosSaleDto getSaleById(UUID id) {
        PosSale sale = posSaleRepository.findById(id)
                .filter(s -> !s.getDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found: " + id));
        return toDto(sale);
    }

    /** created=false means the clientSaleId was already known and no side effects were repeated. */
    public record SaleResult(PosSaleDto dto, boolean created) {}

    @Transactional
    public SaleResult createSale(CreatePosSaleRequest request) {
        // IDEMPOTENCY: an offline register retries the same POST until it gets a response, so a
        // replayed clientSaleId must short-circuit before any stock/voucher/points side effect.
        Optional<PosSale> existing = posSaleRepository.findByClientSaleId(request.getClientSaleId());
        if (existing.isPresent()) {
            return new SaleResult(toDto(existing.get()), false);
        }

        String paymentMethod = request.getPaymentMethod() == null ? "" : request.getPaymentMethod().trim().toUpperCase();
        if (!ALLOWED_PAYMENT_METHODS.contains(paymentMethod)) {
            throw new IllegalArgumentException("paymentMethod must be one of " + ALLOWED_PAYMENT_METHODS);
        }

        // ---- Build lines, validate stock + price, compute subtotal ------------------------
        List<Product> products = new ArrayList<>();
        List<PosSaleLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal floorTotal = BigDecimal.ZERO;

        for (CreatePosSaleRequest.PosSaleLineRequest lineReq : request.getLines()) {
            Product product = productRepository.findByIdAndDeletedFalse(lineReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + lineReq.getProductId()));

            int quantity = lineReq.getQuantity();
            if (quantity < 1) {
                // Defensive - CreatePosSaleRequest.PosSaleLineRequest already @Min(1)-validates
                // this at the bean-validation layer, but a service-level guard costs nothing and
                // protects any future caller that bypasses the DTO validation.
                throw new IllegalArgumentException("quantity must be at least 1 for product " + product.getSku());
            }
            if (product.getStockQuantity() - quantity < 0) {
                throw new IllegalArgumentException(String.format(
                        "Insufficient stock for product %s: available %d, requested %d",
                        product.getSku(), product.getStockQuantity(), quantity));
            }

            BigDecimal unitPrice = lineReq.getUnitPrice();
            if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("unitPrice must not be negative for product " + product.getSku());
            }

            BigDecimal lineDiscount = lineReq.getLineDiscount() != null ? lineReq.getLineDiscount() : BigDecimal.ZERO;
            if (lineDiscount.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("lineDiscount must not be negative for product " + product.getSku());
            }

            // CRITICAL FIX 2: unitPrice must sit within [floor, product.unitPrice] - never above
            // list price (silent overcharge), never below the floor (abuse, e.g. RM0.01 sale of a
            // RM250 item). A legitimate markdown (staff discretion) is always allowed within that
            // range.
            BigDecimal floor = priceFloor(product);
            if (unitPrice.compareTo(product.getUnitPrice()) > 0) {
                throw new IllegalArgumentException(String.format(
                        "unitPrice %s for product %s exceeds the product's price %s - the allowed range is %s to %s",
                        unitPrice, product.getSku(), product.getUnitPrice(), floor, product.getUnitPrice()));
            }
            if (unitPrice.compareTo(floor) < 0) {
                throw new IllegalArgumentException(String.format(
                        "unitPrice %s for product %s is below the minimum allowed price %s - the allowed range is %s to %s",
                        unitPrice, product.getSku(), floor, floor, product.getUnitPrice()));
            }

            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(quantity)).subtract(lineDiscount);
            if (lineTotal.compareTo(BigDecimal.ZERO) < 0) {
                lineTotal = BigDecimal.ZERO;
            }

            // Same floor treatment for lineDiscount: the effective per-unit price after the
            // discount can't be pushed below the same floor either.
            BigDecimal lineFloorTotal = floor.multiply(BigDecimal.valueOf(quantity));
            if (lineTotal.compareTo(lineFloorTotal) < 0) {
                throw new IllegalArgumentException(String.format(
                        "lineDiscount %s for product %s would take the line total (%s) below the minimum allowed " +
                                "total %s (floor price %s x quantity %d)",
                        lineDiscount, product.getSku(), lineTotal, lineFloorTotal, floor, quantity));
            }

            subtotal = subtotal.add(lineTotal);
            floorTotal = floorTotal.add(lineFloorTotal);

            PosSaleLine line = new PosSaleLine();
            line.setProductId(product.getId());
            line.setProductName(product.getName());
            line.setQuantity(quantity);
            line.setUnitPrice(unitPrice);
            line.setLineDiscount(lineDiscount);
            line.setLineTotal(lineTotal);
            line.setAcquisitionCostSnapshot(product.getAcquisitionCost());

            products.add(product);
            lines.add(line);
        }

        // ---- Discounts: member, then voucher, then cart - each computed off the running
        // remaining amount (sequential stacking), per the contract's stated order. ------------
        Member member = null;
        BigDecimal memberDiscount = BigDecimal.ZERO;
        if (request.getMemberId() != null) {
            member = memberService.getEntity(request.getMemberId());
            if (member.getDiscountPercent() != null && member.getDiscountPercent().compareTo(BigDecimal.ZERO) > 0) {
                memberDiscount = subtotal.multiply(member.getDiscountPercent())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
        }
        BigDecimal afterMemberDiscount = clampToZero(subtotal.subtract(memberDiscount));

        BigDecimal voucherDiscount = BigDecimal.ZERO;
        String appliedVoucherCode = null;
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            VoucherService.VoucherApplication application = voucherService.applyVoucher(request.getVoucherCode(), afterMemberDiscount);
            voucherDiscount = application.discountAmount();
            appliedVoucherCode = application.code();
        }
        BigDecimal afterVoucherDiscount = clampToZero(afterMemberDiscount.subtract(voucherDiscount));

        BigDecimal cartDiscount = request.getCartDiscount() != null ? request.getCartDiscount() : BigDecimal.ZERO;
        if (cartDiscount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("cartDiscount must not be negative");
        }

        // CRITICAL FIX 2: same floor treatment as lineDiscount, applied at the cart level - a
        // cashier can still stack member/voucher discounts freely (those are pre-approved
        // mechanisms, not free-form cashier input), but the additional cartDiscount specifically
        // can't push the sale below the sum of the per-line cost floors computed above.
        BigDecimal maxAllowedCartDiscount = afterVoucherDiscount.subtract(floorTotal);
        if (maxAllowedCartDiscount.compareTo(BigDecimal.ZERO) < 0) {
            maxAllowedCartDiscount = BigDecimal.ZERO;
        }
        if (cartDiscount.compareTo(maxAllowedCartDiscount) > 0) {
            throw new IllegalArgumentException(String.format(
                    "cartDiscount %s would take the sale below its minimum allowed total of %s - the maximum " +
                            "cartDiscount allowed right now is %s",
                    cartDiscount, floorTotal, maxAllowedCartDiscount));
        }

        // "S" in the part-exchange contract: the amount owed for the goods before store credit
        // redemption or trade-in netting - this is what Sales Revenue recognizes, and is exactly
        // the historical `total` when neither feature is used.
        BigDecimal salesRevenueAmount = clampToZero(afterVoucherDiscount.subtract(cartDiscount));

        BigDecimal discountTotal = memberDiscount.add(voucherDiscount).add(cartDiscount);

        // ---- WP: store credit redemption - clamped to the amount owed (can't redeem more store
        // credit than the sale needs), but deliberately NOT pre-clamped to the member's balance:
        // MemberService#debitStoreCredit is the sole authority on the overdraft guard (400) below,
        // so a genuine over-redemption attempt surfaces as a real failure rather than being
        // silently discarded. ------------------------------------------------------------------
        BigDecimal requestedStoreCredit = request.getStoreCreditRedeemed() != null
                ? request.getStoreCreditRedeemed() : BigDecimal.ZERO;
        if (requestedStoreCredit.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("storeCreditRedeemed must not be negative");
        }
        if (requestedStoreCredit.compareTo(BigDecimal.ZERO) > 0 && member == null) {
            throw new IllegalArgumentException("storeCreditRedeemed requires a memberId");
        }
        BigDecimal storeCreditRedeemed = requestedStoreCredit.min(salesRevenueAmount);
        BigDecimal afterStoreCredit = salesRevenueAmount.subtract(storeCreditRedeemed);

        // ---- WP: part-exchange trade-in. BUGFIX: this used to always value every line at the
        // credit rate (offeredCreditValue) regardless of the register's trade-in payout dropdown,
        // so an operator who explicitly chose CASH still had the sale post a STORE_CREDIT-rate
        // value - a silent overrule of the operator, and a display-vs-posted mismatch (the same
        // class of defect as a previously-caught voucher bug). tradeInPayoutType now resolves what
        // the request actually asked for (defaulting to STORE_CREDIT - the original behaviour -
        // when the field is omitted, so older/offline-queued payloads keep working unchanged), and
        // that same resolved type is threaded through to PosTradeInService#createEmbeddedForSale
        // below so the persisted trade-in's own payoutAmount/product cost basis matches exactly
        // what this sale applies. Computed here from the request only (the Product/PosTradeIn rows
        // themselves are created further down, once the sale has an id to link back to) so
        // netCashAmount/netCashDirection can be validated before any stock mutation happens. -------
        CreatePosSaleRequest.TradeInRequest tradeInRequest = request.getTradeIn();
        BigDecimal tradeInValueApplied = BigDecimal.ZERO;
        String tradeInPayoutType = "STORE_CREDIT";
        if (tradeInRequest != null) {
            tradeInPayoutType = resolveTradeInPayoutType(tradeInRequest.getPayoutType());
            boolean useCashValue = "CASH".equals(tradeInPayoutType);
            for (CreatePosTradeInRequest.TradeInLineRequest line : tradeInRequest.getLines()) {
                BigDecimal cashValue = line.getOfferedCashValue() != null ? line.getOfferedCashValue() : BigDecimal.ZERO;
                BigDecimal creditValue = line.getOfferedCreditValue() != null ? line.getOfferedCreditValue() : BigDecimal.ZERO;
                tradeInValueApplied = tradeInValueApplied.add(useCashValue ? cashValue : creditValue);
            }
        }

        // CRITICAL: netCashAmount is deliberately NOT clamped to zero - a negative value means the
        // shop owes the customer cash (tradeInValueApplied exceeded what was left to pay) and must
        // be preserved through to the response/journal, unlike every discount step above.
        BigDecimal netCashAmount = afterStoreCredit.subtract(tradeInValueApplied);
        String netCashDirection = determineNetCashDirection(netCashAmount);

        // V36 (guided void): when the trade-in is valued at the STORE_CREDIT rate and its value
        // exceeds what this sale needed (would otherwise be a SHOP_PAYS cash payout), grant the
        // excess to the member's store credit balance instead of paying cash out - this is the
        // only piece of a part-exchange's value that is ever separately, persistently posted to
        // the member's own balance (everything else nets directly into this sale's own cash flow,
        // unchanged), so #voidSale has a real, guarded (can't take the balance negative) ledger
        // entry to reverse for this specific case. Never double-counts: this only ever grants the
        // portion beyond what nets the sale to zero, never the full tradeInValueApplied (which is
        // still fully, and only once, applied against the sale above).
        BigDecimal tradeInStoreCreditGranted = BigDecimal.ZERO;
        if (tradeInRequest != null && "STORE_CREDIT".equals(tradeInPayoutType) && netCashAmount.compareTo(BigDecimal.ZERO) < 0) {
            if (member == null) {
                log.warn("Part-exchange trade-in valued at the STORE_CREDIT rate produced a SHOP_PAYS excess of {} " +
                        "with no member attached to the sale - falling back to a cash payout for the excess", netCashAmount.negate());
            } else {
                tradeInStoreCreditGranted = netCashAmount.negate();
                netCashAmount = BigDecimal.ZERO;
                netCashDirection = "EVEN";
            }
        }

        // ---- Payment / tender - only a positive netCashAmount requires anything from the
        // customer; SHOP_PAYS/EVEN need no tender at all. ---------------------------------------
        BigDecimal amountTendered = request.getAmountTendered();
        BigDecimal change = null;
        BigDecimal amountDueFromCustomer = netCashAmount.compareTo(BigDecimal.ZERO) > 0 ? netCashAmount : BigDecimal.ZERO;
        if ("CASH".equals(paymentMethod) && amountDueFromCustomer.compareTo(BigDecimal.ZERO) > 0) {
            if (amountTendered == null || amountTendered.compareTo(amountDueFromCustomer) < 0) {
                throw new IllegalArgumentException(String.format(
                        "Insufficient amount tendered: total %s, tendered %s", amountDueFromCustomer, amountTendered));
            }
            change = amountTendered.subtract(amountDueFromCustomer);
        }

        // Generated up front (not just before persisting) so it's available as the WP7 ledger
        // reference for the stock decrement loop below; generateSaleNumber() only reads
        // posSaleRepository.count(), so calling it earlier has no side effects to reorder around.
        String saleNumber = generateSaleNumber();

        // ---- Stock: Product.stockQuantity (authoritative total) + warehouse_stock MAIN, same
        // two-step pattern as InventoryService for stock adjustments. -------------------------
        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();
        for (int i = 0; i < products.size(); i++) {
            Product product = products.get(i);
            int quantity = lines.get(i).getQuantity();
            product.setStockQuantity(product.getStockQuantity() - quantity);
            productRepository.save(product);
            warehouseStockService.decrementValidated(mainWarehouseId, product, quantity);
            // Product is mutated directly here (not via ProductService.updateProduct), so the
            // Redis-cached DTO for this id must be evicted explicitly - see evictProductCache.
            productService.evictProductCache(product.getId());

            // WP7: ledger row in the same transaction as the decrement above.
            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.POS_SALE,
                    -quantity, saleNumber, null);
        }

        // ---- Persist the sale -----------------------------------------------------------------
        PosSale sale = new PosSale();
        sale.setSaleNumber(saleNumber);
        sale.setClientSaleId(request.getClientSaleId());
        sale.setMemberId(request.getMemberId());
        sale.setVoucherCode(appliedVoucherCode);
        sale.setPaymentMethod(paymentMethod);
        sale.setSubtotal(subtotal);
        sale.setDiscountTotal(discountTotal);
        // `total` now carries the final net cash amount (can be negative - SHOP_PAYS); this is
        // exactly the historical `total` semantics when tradeInValueApplied/storeCreditRedeemed
        // are both zero.
        sale.setTotal(netCashAmount);
        sale.setAmountTendered(amountTendered);
        sale.setChange(change);
        sale.setTradeInValueApplied(tradeInValueApplied);
        sale.setStoreCreditRedeemed(storeCreditRedeemed);
        sale.setNetCashAmount(netCashAmount);
        sale.setNetCashDirection(netCashDirection);
        sale.setTradeInStoreCreditGranted(tradeInStoreCreditGranted);

        // Points are earned on the value of goods sold (S), not the net cash flow - a shopper who
        // pays partly by store credit or trade-in still earns points on the full purchase value.
        int pointsEarned = salesRevenueAmount.setScale(0, RoundingMode.FLOOR).intValue();
        sale.setPointsEarned(pointsEarned);

        for (PosSaleLine line : lines) {
            sale.addLine(line);
        }

        PosSale saved = posSaleRepository.save(sale);

        // ---- Member points accrual + tier recompute ------------------------------------------
        if (member != null) {
            memberService.accruePoints(member.getId(), pointsEarned);
        }

        // ---- WP: store credit redemption - debited synchronously (not non-blocking): an
        // overdraft attempt must fail the whole sale (400), never silently succeed. -------------
        if (storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0) {
            memberService.debitStoreCredit(member.getId(), storeCreditRedeemed);
        }

        // ---- V36: trade-in store-credit-excess grant (see above) - synchronous, same rationale
        // as store credit redemption: this is real money-adjacent state, not a best-effort hook. --
        if (tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0) {
            memberService.creditStoreCredit(member.getId(), tradeInStoreCreditGranted);
        }

        // ---- WP: part-exchange trade-in - creates the Product(s) + TRADE_IN_RECEIPT movement(s)
        // now that the sale has an id to link back to; never posts its own journal entry (folded
        // into this sale's combined entry below instead). ---------------------------------------
        if (tradeInRequest != null) {
            PosTradeIn tradeIn = posTradeInService.createEmbeddedForSale(
                    tradeInRequest.getClientTradeInId(), tradeInRequest.getLines(), request.getMemberId(), saved.getId(),
                    tradeInPayoutType);
            saved.setTradeInId(tradeIn.getId());
            saved = posSaleRepository.save(saved);
        }

        // ---- Accounting: non-blocking draft journal entries (WP4a pattern) -------------------
        createSaleJournalEntries(saved, salesRevenueAmount);

        // ---- REPAIR/WARRANTY: non-blocking auto-issue, one warranty per unit whose product
        // has warrantyMonths set - never fails the sale (same pattern as the journal hooks above).
        issueLineWarranties(products, lines, saved.getId(), saved.getSaleNumber(), request.getMemberId());

        return new SaleResult(toDto(saved), true);
    }

    /** {@code refundMethod}/{@code refundAmount} - see {@link VoidPosSaleResponseDto} Javadoc for
     * why store credit/points/voucher reversal are NOT part of this pair. V36: also carries
     * exactly what was reversed, for {@link VoidPosSaleResponseDto}. */
    public record VoidResult(
            PosSaleDto dto,
            String refundMethod,
            BigDecimal refundAmount,
            List<VoidPosSaleResponseDto.StockReturnedItem> stockReturned,
            VoidPosSaleResponseDto.TradeInItemRemoved tradeInItemRemoved,
            BigDecimal storeCreditReversed,
            Integer pointsDeducted,
            BigDecimal tradeInStoreCreditDeducted
    ) {}

    /**
     * V34/V36: reverses a completed PoS sale - stock returned, sale/COGS journal entries reversed
     * (as SYSTEM entries, so they post per the same auto-post policy as the original), and any
     * member store credit/points/voucher usage tied to the sale reversed. The original sale row
     * is never edited beyond the status/voided* columns, and the original POS_SALE stock
     * movement is never touched - the ledger stays append-only; a SALE_VOID movement is written
     * alongside it.
     *
     * <p>RoleRules.MANAGER_UP backs the controller endpoint - a cashier must not be able to erase
     * their own mistakes silently, so voiding is a deliberate manager/admin action, always with a
     * recorded reason.
     *
     * <p>V36: a part-exchange sale (tradeInId set) is now reversed in full, in this same
     * transaction, as three legs:
     * <ol>
     *   <li><b>Sold goods</b> - unchanged from V34: every sale line's stock is returned
     *   (SALE_VOID).</li>
     *   <li><b>Traded-in item</b> - its stock is removed again (TRADE_IN_VOID, negative delta) and
     *   the trade-in itself is marked VOIDED. SAFETY: refused (409) if that product's stock has
     *   since dropped below what was originally received, or if it has ever had a "left the
     *   building" movement recorded against it (resold, consumed as a repair part, or transferred
     *   away) - reversing someone else's purchase/consumption of it is never attempted
     *   automatically.</li>
     *   <li><b>Money</b> - the sale/COGS journals reverse exactly as V34 did (cash direction
     *   already generic via {@link CashAccountResolver}/netCashDirection), plus (new) the
     *   trade-in's own Inventory journal leg, plus (new) any trade-in over-valuation store-credit
     *   grant is clawed back from the member - refused (409) if their balance has since been spent
     *   below that amount, since driving it negative would effectively charge them for someone
     *   else's spending.</li>
     * </ol>
     * All validation (already-voided, void window, trade-in safety, store-credit-clawback
     * sufficiency) happens before any mutation, so a rejected void changes nothing - this also
     * makes a double-void impossible to partially apply (the very first check, already-voided,
     * catches it).
     */
    @Transactional
    public VoidResult voidSale(UUID id, String reason) {
        PosSale sale = posSaleRepository.findById(id)
                .filter(s -> !s.getDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Sale not found: " + id));

        if (STATUS_VOIDED.equals(sale.getStatus())) {
            throw new IllegalStateException("Sale " + sale.getSaleNumber() + " has already been voided");
        }

        LocalDateTime cutoff = LocalDateTime.now().minusDays(voidWindowDays);
        if (sale.getCreatedAt().isBefore(cutoff)) {
            throw new IllegalStateException(String.format(
                    "Sale %s was made on %s, more than %d day(s) ago, and is outside the void window - it can no longer be voided",
                    sale.getSaleNumber(), sale.getCreatedAt().toLocalDate(), voidWindowDays));
        }

        // ---- V36: part-exchange - load + validate BEFORE any mutation, so a refusal here leaves
        // absolutely nothing changed. --------------------------------------------------------
        PosTradeIn tradeIn = null;
        Map<UUID, Product> tradeInProducts = new LinkedHashMap<>();
        if (sale.getTradeInId() != null) {
            tradeIn = posTradeInRepository.findById(sale.getTradeInId())
                    .orElseThrow(() -> new ResourceNotFoundException("Trade-in not found: " + sale.getTradeInId()));

            if (TRADE_IN_STATUS_VOIDED.equals(tradeIn.getStatus())) {
                throw new IllegalStateException(String.format(
                        "Trade-in %s linked to sale %s has already been voided", tradeIn.getTradeInNumber(), sale.getSaleNumber()));
            }

            for (PosTradeInLine line : tradeIn.getLines()) {
                Product product = productRepository.findById(line.getProductId())
                        .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + line.getProductId()));
                tradeInProducts.put(product.getId(), product);

                // Each trade-in line always creates exactly one dedicated unit of a brand-new
                // product (see PosTradeInService#receiveLines) - so "the traded-in quantity" is
                // always 1 here, never a client-supplied number.
                int tradedInQuantity = 1;
                boolean leftTheBuilding = stockMovementRepository.existsByProduct_IdAndMovementTypeIn(
                        product.getId(), TRADE_IN_CONSUMING_MOVEMENT_TYPES);
                if (product.getStockQuantity() < tradedInQuantity || leftTheBuilding) {
                    throw new IllegalStateException(String.format(
                            "Cannot void sale %s: the traded-in item '%s' (SKU %s) has already moved on - " +
                                    "it has been resold, consumed as a repair part, transferred away, or adjusted " +
                                    "down since it was received (current stock %d, traded-in quantity %d). Reverse " +
                                    "that downstream transaction first, or handle this trade-in reversal as a " +
                                    "manual stock adjustment instead.",
                            sale.getSaleNumber(), product.getName(), product.getSku(),
                            product.getStockQuantity(), tradedInQuantity));
                }
            }
        }

        // ---- V36: money safety check - the trade-in over-valuation store-credit grant must be
        // clawed back from the member; refuse if they've already spent it. ----------------------
        BigDecimal tradeInStoreCreditGranted = sale.getTradeInStoreCreditGranted() != null
                ? sale.getTradeInStoreCreditGranted() : BigDecimal.ZERO;
        if (tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0) {
            Member member = memberService.getEntity(sale.getMemberId());
            if (member.getStoreCreditBalance().compareTo(tradeInStoreCreditGranted) < 0) {
                throw new IllegalStateException(String.format(
                        "Cannot void sale %s: this part-exchange granted %s store credit to member %s, but their " +
                                "balance has since been spent below that amount (current balance %s) - reverse " +
                                "whatever spent it first, or this cannot be safely clawed back.",
                        sale.getSaleNumber(), tradeInStoreCreditGranted, member.getCode(), member.getStoreCreditBalance()));
            }
        }

        // ==== All validation passed - begin mutation ==========================================

        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();

        // ---- (a) Sold goods: return stock, same two-step pattern as createSale's decrement, plus
        // an independent SALE_VOID ledger row per line - the original POS_SALE movement is never
        // edited or deleted. -------------------------------------------------------------------
        List<VoidPosSaleResponseDto.StockReturnedItem> stockReturned = new ArrayList<>();
        for (PosSaleLine line : sale.getLines()) {
            Product product = productRepository.findById(line.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + line.getProductId()));
            product.setStockQuantity(product.getStockQuantity() + line.getQuantity());
            productRepository.save(product);
            warehouseStockService.applyDelta(mainWarehouseId, product, line.getQuantity());
            productService.evictProductCache(product.getId());

            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.SALE_VOID,
                    line.getQuantity(), sale.getSaleNumber(), "Void: " + reason);
            stockReturned.add(new VoidPosSaleResponseDto.StockReturnedItem(
                    product.getId(), product.getSku(), product.getName(), line.getQuantity()));
        }

        // ---- (b) Traded-in item: remove its stock again (TRADE_IN_VOID, negative delta) and mark
        // the trade-in VOIDED - the original TRADE_IN_RECEIPT movement is never edited/deleted. --
        // V38: for a line LINKED to a pre-existing product (see PosTradeInService), also restore
        // that product's acquisitionCost to its exact pre-trade-in value (line.previousAcquisitionCost,
        // stamped at receipt time) rather than trying to recompute it backwards out of the weighted
        // average - not always invertible once further stock movements have happened since. An
        // unlinked line's product keeps whatever acquisitionCost it was created with (nothing to
        // restore there - previousAcquisitionCost is null for those lines by construction).
        VoidPosSaleResponseDto.TradeInItemRemoved tradeInItemRemoved = null;
        if (tradeIn != null) {
            for (PosTradeInLine line : tradeIn.getLines()) {
                Product product = tradeInProducts.get(line.getProductId());
                product.setStockQuantity(product.getStockQuantity() - 1);
                if (Boolean.TRUE.equals(line.getLinkedExistingProduct())) {
                    product.setAcquisitionCost(line.getPreviousAcquisitionCost());
                }
                productRepository.save(product);
                warehouseStockService.decrementValidated(mainWarehouseId, product, 1);
                productService.evictProductCache(product.getId());

                stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.TRADE_IN_VOID,
                        -1, sale.getSaleNumber(), "Void: " + reason + " (trade-in " + tradeIn.getTradeInNumber() + ")");
                tradeInItemRemoved = new VoidPosSaleResponseDto.TradeInItemRemoved(
                        product.getId(), product.getSku(), product.getName(), 1, tradeIn.getTradeInNumber());
            }
            tradeIn.setStatus(TRADE_IN_STATUS_VOIDED);
            tradeIn.setVoidedAt(LocalDateTime.now());
            posTradeInRepository.save(tradeIn);
        }

        // ---- (c) Money: reverse the sale/COGS/trade-in journals as SYSTEM entries (auto-posted
        // per the same policy as the original), never mutating/deleting the original entries. ---
        createVoidJournalEntries(sale);

        // ---- Refund handling (physical cash/card/e-wallet only - see VoidPosSaleResponseDto) ---
        String refundMethod = sale.getPaymentMethod();
        BigDecimal netCashAmount = sale.getNetCashAmount() != null ? sale.getNetCashAmount() : BigDecimal.ZERO;
        BigDecimal refundAmount = netCashAmount.compareTo(BigDecimal.ZERO) > 0 ? netCashAmount : BigDecimal.ZERO;

        BigDecimal storeCreditReversed = BigDecimal.ZERO;
        if (sale.getStoreCreditRedeemed() != null && sale.getStoreCreditRedeemed().compareTo(BigDecimal.ZERO) > 0
                && sale.getMemberId() != null) {
            memberService.creditStoreCredit(sale.getMemberId(), sale.getStoreCreditRedeemed());
            storeCreditReversed = sale.getStoreCreditRedeemed();
        }
        Integer pointsDeducted = 0;
        if (sale.getPointsEarned() != null && sale.getPointsEarned() > 0 && sale.getMemberId() != null) {
            memberService.deductPoints(sale.getMemberId(), sale.getPointsEarned());
            pointsDeducted = sale.getPointsEarned();
        }
        if (sale.getVoucherCode() != null && !sale.getVoucherCode().isBlank()) {
            voucherService.releaseUsage(sale.getVoucherCode());
        }

        // ---- V36: claw back the trade-in over-valuation store-credit grant, if any - already
        // validated as safe above; debitStoreCredit's own guard is a defensive second check under
        // concurrency, not the primary 409 path. ------------------------------------------------
        BigDecimal tradeInStoreCreditDeducted = BigDecimal.ZERO;
        if (tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0) {
            memberService.debitStoreCredit(sale.getMemberId(), tradeInStoreCreditGranted);
            tradeInStoreCreditDeducted = tradeInStoreCreditGranted;
        }

        // ---- Mark voided (append-only: no other column on this row changes) -------------------
        sale.setStatus(STATUS_VOIDED);
        sale.setVoidedAt(LocalDateTime.now());
        sale.setVoidedBy(currentUsername());
        sale.setVoidReason(reason);
        PosSale saved = posSaleRepository.save(sale);

        return new VoidResult(toDto(saved), refundMethod, refundAmount, stockReturned, tradeInItemRemoved,
                storeCreditReversed, pointsDeducted, tradeInStoreCreditDeducted);
    }

    /**
     * Mirror of #postRevenueEntry/#postCogsEntry with debit/credit swapped - reverses exactly the
     * entry(ies) the original sale posted, INCLUDING (V36) a part-exchange sale's trade-in
     * Inventory leg and any trade-in over-valuation store-credit grant - same balancing identity
     * (Debits: S + cashOut + G; Credits: T + cashIn + R) as the original, just flipped, so this
     * always balances by construction whether or not a trade-in was involved.
     */
    private void createVoidJournalEntries(PosSale sale) {
        try {
            BigDecimal salesRevenueAmount = sale.getSubtotal().subtract(sale.getDiscountTotal());
            if (salesRevenueAmount.compareTo(BigDecimal.ZERO) < 0) {
                salesRevenueAmount = BigDecimal.ZERO;
            }
            BigDecimal storeCreditRedeemed = sale.getStoreCreditRedeemed() != null ? sale.getStoreCreditRedeemed() : BigDecimal.ZERO;
            BigDecimal tradeInValue = sale.getTradeInValueApplied() != null ? sale.getTradeInValueApplied() : BigDecimal.ZERO;
            BigDecimal tradeInStoreCreditGranted = sale.getTradeInStoreCreditGranted() != null ? sale.getTradeInStoreCreditGranted() : BigDecimal.ZERO;
            BigDecimal net = sale.getNetCashAmount() != null ? sale.getNetCashAmount() : BigDecimal.ZERO;
            BigDecimal cashIn = net.compareTo(BigDecimal.ZERO) > 0 ? net : BigDecimal.ZERO;
            BigDecimal cashOut = net.compareTo(BigDecimal.ZERO) < 0 ? net.negate() : BigDecimal.ZERO;

            if (salesRevenueAmount.compareTo(BigDecimal.ZERO) <= 0 && cashIn.compareTo(BigDecimal.ZERO) <= 0
                    && cashOut.compareTo(BigDecimal.ZERO) <= 0 && storeCreditRedeemed.compareTo(BigDecimal.ZERO) <= 0
                    && tradeInValue.compareTo(BigDecimal.ZERO) <= 0 && tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) <= 0) {
                return;
            }

            // WP (cash-leg split): reverse against the SAME account the original sale posted to -
            // derived the same way the original posting did (sale.getPaymentMethod() through
            // CashAccountResolver), never hardcoded, so a CARD sale's void reverses 1112, an
            // EWALLET sale's void reverses 1113, etc.
            Optional<Account> cash = accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode(sale.getPaymentMethod()));
            Optional<Account> salesRevenue = accountRepository.findByCodeAndDeletedFalse(SALES_REVENUE_ACCOUNT_CODE);
            boolean needsStoreCreditLiability = storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0
                    || tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0;
            Optional<Account> storeCreditLiability = needsStoreCreditLiability
                    ? accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode("STORE_CREDIT")) : Optional.empty();
            Optional<Account> inventory = tradeInValue.compareTo(BigDecimal.ZERO) > 0
                    ? accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE) : Optional.empty();

            if (cash.isEmpty() || salesRevenue.isEmpty()
                    || (needsStoreCreditLiability && storeCreditLiability.isEmpty())
                    || (tradeInValue.compareTo(BigDecimal.ZERO) > 0 && inventory.isEmpty())) {
                log.warn("Skipping void revenue-reversal auto-journal for PoS sale {}: missing well-known account(s)", sale.getSaleNumber());
            } else {
                List<JournalEntryLineDTO> lines = new ArrayList<>();
                if (salesRevenueAmount.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(debitLine(salesRevenue.get().getId(), salesRevenueAmount, "Void reversal: Sales Revenue - PoS Sale " + sale.getSaleNumber()));
                }
                if (cashOut.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(debitLine(cash.get().getId(), cashOut, "Void reversal: cash reclaimed - PoS Sale " + sale.getSaleNumber()));
                }
                if (tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(debitLine(storeCreditLiability.get().getId(), tradeInStoreCreditGranted, "Void reversal: trade-in store credit grant clawed back - PoS Sale " + sale.getSaleNumber()));
                }
                if (cashIn.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(creditLine(cash.get().getId(), cashIn, "Void reversal: cash refunded - PoS Sale " + sale.getSaleNumber()));
                }
                if (storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(creditLine(storeCreditLiability.get().getId(), storeCreditRedeemed, "Void reversal: store credit reinstated - PoS Sale " + sale.getSaleNumber()));
                }
                if (tradeInValue.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(creditLine(inventory.get().getId(), tradeInValue, "Void reversal: trade-in inventory removed - PoS Sale " + sale.getSaleNumber()));
                }

                JournalEntryDTO entry = new JournalEntryDTO();
                entry.setEntryDate(LocalDate.now());
                entry.setDescription("Auto-generated: Void of PoS Sale " + sale.getSaleNumber());
                entry.setReference(sale.getSaleNumber());
                entry.setLines(lines);

                // CRITICAL FIX 3 pattern: REQUIRES_NEW so a posting failure here never rolls back
                // the void transaction that's still open above us.
                nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
            }
        } catch (Exception e) {
            log.warn("Failed to create void revenue-reversal auto-journal entry for PoS sale {}: {}", sale.getSaleNumber(), e.getMessage());
        }

        try {
            BigDecimal cogsTotal = sale.getLines().stream()
                    .filter(line -> line.getAcquisitionCostSnapshot() != null)
                    .map(line -> line.getAcquisitionCostSnapshot().multiply(BigDecimal.valueOf(line.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (cogsTotal.compareTo(BigDecimal.ZERO) <= 0) {
                return;
            }

            Optional<Account> cogs = accountRepository.findByCodeAndDeletedFalse(COGS_ACCOUNT_CODE);
            Optional<Account> inventory = accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE);
            if (cogs.isEmpty() || inventory.isEmpty()) {
                log.warn("Skipping void COGS-reversal auto-journal for PoS sale {}: missing well-known account(s) {}/{}",
                        sale.getSaleNumber(), COGS_ACCOUNT_CODE, INVENTORY_ACCOUNT_CODE);
                return;
            }

            JournalEntryLineDTO debitInventory = new JournalEntryLineDTO();
            debitInventory.setAccountId(inventory.get().getId());
            debitInventory.setDebit(cogsTotal);
            debitInventory.setCredit(BigDecimal.ZERO);
            debitInventory.setDescription("Void reversal: Inventory - PoS Sale " + sale.getSaleNumber());

            JournalEntryLineDTO creditCogs = new JournalEntryLineDTO();
            creditCogs.setAccountId(cogs.get().getId());
            creditCogs.setDebit(BigDecimal.ZERO);
            creditCogs.setCredit(cogsTotal);
            creditCogs.setDescription("Void reversal: COGS - PoS Sale " + sale.getSaleNumber());

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Void of PoS Sale " + sale.getSaleNumber() + " (COGS reversal)");
            entry.setReference(sale.getSaleNumber());
            entry.setLines(List.of(debitInventory, creditCogs));

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create void COGS-reversal auto-journal entry for PoS sale {}: {}", sale.getSaleNumber(), e.getMessage());
        }
    }

    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            return "system";
        }
        return authentication.getName();
    }

    private String determineNetCashDirection(BigDecimal netCashAmount) {
        int cmp = netCashAmount.compareTo(BigDecimal.ZERO);
        if (cmp > 0) return "CUSTOMER_PAYS";
        if (cmp < 0) return "SHOP_PAYS";
        return "EVEN";
    }

    /** BUGFIX: resolves {@link CreatePosSaleRequest.TradeInRequest#getPayoutType()} to CASH or
     * STORE_CREDIT, defaulting to STORE_CREDIT (the original, only-ever-credit-rate behaviour)
     * when the field is absent/blank - keeps older/offline-queued sale payloads working unchanged.
     * Rejects (400) any other value rather than silently falling back, since a typo'd payoutType
     * would otherwise silently mis-value the trade-in. */
    private String resolveTradeInPayoutType(String requested) {
        if (requested == null || requested.isBlank()) {
            return "STORE_CREDIT";
        }
        String normalized = requested.trim().toUpperCase();
        if (!TRADE_IN_VALUATION_TYPES.contains(normalized)) {
            throw new IllegalArgumentException("tradeIn.payoutType must be one of " + TRADE_IN_VALUATION_TYPES);
        }
        return normalized;
    }

    /**
     * REPAIR/WARRANTY: one warranty per unit sold on a line whose product has warrantyMonths set
     * (DATA INTEGRITY fix - previously one warranty per LINE regardless of quantity, so a 2-unit
     * sale could only ever have one warranty claimed against it) - per-line so a single bad
     * product/line doesn't stop warranties being issued for the rest of the sale. Runs each
     * product's issuance through {@link NonBlockingHookExecutor} (CRITICAL FIX 3) so a genuine
     * failure only rolls back that hook's own REQUIRES_NEW transaction, never the sale itself.
     * Never throws - a failure here must never fail an already-completed sale.
     */
    private void issueLineWarranties(List<Product> products, List<PosSaleLine> lines, UUID posSaleId, String saleNumber, UUID memberId) {
        for (int i = 0; i < products.size(); i++) {
            Product product = products.get(i);
            int quantity = lines.get(i).getQuantity();
            try {
                nonBlockingHookExecutor.runInNewTransaction(
                        () -> warrantyService.autoIssueForPosSaleLine(product, quantity, posSaleId, memberId));
            } catch (Exception e) {
                log.warn("Failed to auto-issue warranty for product {} on PoS sale {}: {}",
                        product.getSku(), saleNumber, e.getMessage());
            }
        }
    }

    private BigDecimal clampToZero(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : value;
    }

    /**
     * CRITICAL FIX 2: the lowest unitPrice a line is allowed to sell at.
     * <ul>
     *   <li>If the product has a costPrice and/or acquisitionCost set (i.e. > 0), the floor is
     *   the higher of the two - selling below what the store paid is never allowed.</li>
     *   <li>Otherwise (no cost basis recorded on the product), the floor is
     *   {@code mulaerp.pos.max-discount-percent} below the product's current unitPrice, so a
     *   markdown is still bounded even without cost data.</li>
     * </ul>
     */
    private BigDecimal priceFloor(Product product) {
        boolean costPriceSet = product.getCostPrice() != null && product.getCostPrice().compareTo(BigDecimal.ZERO) > 0;
        boolean acquisitionCostSet = product.getAcquisitionCost() != null && product.getAcquisitionCost().compareTo(BigDecimal.ZERO) > 0;

        if (costPriceSet || acquisitionCostSet) {
            BigDecimal cost = costPriceSet ? product.getCostPrice() : BigDecimal.ZERO;
            BigDecimal acquisition = acquisitionCostSet ? product.getAcquisitionCost() : BigDecimal.ZERO;
            return cost.max(acquisition);
        }

        BigDecimal discountFraction = BigDecimal.valueOf(maxDiscountPercent)
                .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return product.getUnitPrice().multiply(BigDecimal.ONE.subtract(discountFraction))
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Auto-journal hook, mirroring InvoiceService#createInvoiceJournalEntry (WP4a): posts DRAFT
     * entries for a human to review - never blocks sale creation on failure. Two entries:
     *   1. the combined sale entry - see #postRevenueEntry, which folds in Inventory/Cash/Store
     *      Credit Liability lines for a part-exchange sale (T/R/Net), collapsing to the original
     *      plain "debit Cash / credit Sales Revenue" shape when neither feature is used.
     *   2. when any line has an acquisitionCostSnapshot: debit COGS (5100) / credit Inventory
     *      (1130) for Sigma(acquisitionCostSnapshot * quantity).
     */
    private void createSaleJournalEntries(PosSale sale, BigDecimal salesRevenueAmount) {
        try {
            postRevenueEntry(sale, salesRevenueAmount);
        } catch (Exception e) {
            log.warn("Failed to create revenue auto-journal entry for PoS sale {}: {}", sale.getSaleNumber(), e.getMessage());
        }

        try {
            postCogsEntry(sale);
        } catch (Exception e) {
            log.warn("Failed to create COGS auto-journal entry for PoS sale {}: {}", sale.getSaleNumber(), e.getMessage());
        }
    }

    /**
     * WP: the combined sale entry. Debits: Inventory (T = tradeInValueApplied, goods received via
     * part-exchange) + Cash (max(Net,0), cash actually received) + Store Credit Liability
     * (R = storeCreditRedeemed, reducing the liability on redemption). Credits: Sales Revenue
     * (S = salesRevenueAmount) + Cash (max(-Net,0), cash paid OUT to the customer when Net is
     * negative - SHOP_PAYS). This always balances exactly by construction: S = Net + R + T, so
     * Credits - Debits = Net - (max(Net,0) - max(-Net,0)) = 0 for any real Net. Collapses to the
     * original two-line "debit Cash / credit Sales Revenue" entry when T = R = 0 and Net = S (no
     * trade-in, no store credit redemption).
     */
    private void postRevenueEntry(PosSale sale, BigDecimal salesRevenueAmount) {
        BigDecimal tradeInValue = sale.getTradeInValueApplied() != null ? sale.getTradeInValueApplied() : BigDecimal.ZERO;
        BigDecimal storeCreditRedeemed = sale.getStoreCreditRedeemed() != null ? sale.getStoreCreditRedeemed() : BigDecimal.ZERO;
        // V36: the over-valued-trade-in excess granted to the member instead of paid out as cash -
        // see #createSale. Uses the same 2140 Store Credit Liability account as storeCreditRedeemed
        // above, just the opposite side (a credit here, increasing the liability, vs. a debit for
        // a redemption decreasing it) - both can appear in the same entry without conflict.
        BigDecimal tradeInStoreCreditGranted = sale.getTradeInStoreCreditGranted() != null ? sale.getTradeInStoreCreditGranted() : BigDecimal.ZERO;
        BigDecimal net = sale.getNetCashAmount() != null ? sale.getNetCashAmount() : BigDecimal.ZERO;
        BigDecimal cashIn = net.compareTo(BigDecimal.ZERO) > 0 ? net : BigDecimal.ZERO;
        BigDecimal cashOut = net.compareTo(BigDecimal.ZERO) < 0 ? net.negate() : BigDecimal.ZERO;

        if (tradeInValue.compareTo(BigDecimal.ZERO) <= 0 && storeCreditRedeemed.compareTo(BigDecimal.ZERO) <= 0
                && salesRevenueAmount.compareTo(BigDecimal.ZERO) <= 0 && cashIn.compareTo(BigDecimal.ZERO) <= 0
                && cashOut.compareTo(BigDecimal.ZERO) <= 0 && tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        // WP (cash-leg split): the "cash received/paid" leg now resolves to the account for
        // however this sale was actually tendered (sale.getPaymentMethod()) - CASH/CARD/EWALLET/
        // STORE_CREDIT -> 1111/1112/1113/2140 respectively (see CashAccountResolver) - instead of
        // always hitting the single legacy 1110 account regardless of tender type.
        Optional<Account> cash = accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode(sale.getPaymentMethod()));
        Optional<Account> salesRevenue = accountRepository.findByCodeAndDeletedFalse(SALES_REVENUE_ACCOUNT_CODE);
        Optional<Account> inventory = tradeInValue.compareTo(BigDecimal.ZERO) > 0
                ? accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE) : Optional.empty();
        boolean needsStoreCreditLiability = storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0
                || tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0;
        Optional<Account> storeCreditLiability = needsStoreCreditLiability
                ? accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode("STORE_CREDIT")) : Optional.empty();

        if (cash.isEmpty() || salesRevenue.isEmpty()
                || (tradeInValue.compareTo(BigDecimal.ZERO) > 0 && inventory.isEmpty())
                || (needsStoreCreditLiability && storeCreditLiability.isEmpty())) {
            log.warn("Skipping revenue auto-journal for PoS sale {}: missing well-known account(s)", sale.getSaleNumber());
            return;
        }

        List<JournalEntryLineDTO> lines = new ArrayList<>();
        if (tradeInValue.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(debitLine(inventory.get().getId(), tradeInValue, "Trade-in inventory received - PoS Sale " + sale.getSaleNumber()));
        }
        if (cashIn.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(debitLine(cash.get().getId(), cashIn, "Cash received - PoS Sale " + sale.getSaleNumber()));
        }
        if (storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(debitLine(storeCreditLiability.get().getId(), storeCreditRedeemed, "Store credit redeemed - PoS Sale " + sale.getSaleNumber()));
        }
        if (salesRevenueAmount.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(creditLine(salesRevenue.get().getId(), salesRevenueAmount, "Sales Revenue - PoS Sale " + sale.getSaleNumber()));
        }
        if (cashOut.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(creditLine(cash.get().getId(), cashOut, "Cash paid to customer - PoS Sale " + sale.getSaleNumber()));
        }
        if (tradeInStoreCreditGranted.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(creditLine(storeCreditLiability.get().getId(), tradeInStoreCreditGranted,
                    "Store credit granted (over-valued trade-in) - PoS Sale " + sale.getSaleNumber()));
        }

        JournalEntryDTO entry = new JournalEntryDTO();
        entry.setEntryDate(LocalDate.now());
        entry.setDescription("Auto-generated: PoS Sale " + sale.getSaleNumber());
        entry.setReference(sale.getSaleNumber());
        entry.setLines(lines);

        // CRITICAL FIX 3: routed through NonBlockingHookExecutor (REQUIRES_NEW) - a validation
        // failure inside createJournalEntry (e.g. an unbalanced entry) rolls back only this
        // journal-entry transaction, never the PoS sale transaction that's still open above us.
        nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
    }

    private JournalEntryLineDTO debitLine(UUID accountId, BigDecimal amount, String description) {
        JournalEntryLineDTO line = new JournalEntryLineDTO();
        line.setAccountId(accountId);
        line.setDebit(amount);
        line.setCredit(BigDecimal.ZERO);
        line.setDescription(description);
        return line;
    }

    private JournalEntryLineDTO creditLine(UUID accountId, BigDecimal amount, String description) {
        JournalEntryLineDTO line = new JournalEntryLineDTO();
        line.setAccountId(accountId);
        line.setDebit(BigDecimal.ZERO);
        line.setCredit(amount);
        line.setDescription(description);
        return line;
    }

    private void postCogsEntry(PosSale sale) {
        BigDecimal cogsTotal = sale.getLines().stream()
                .filter(line -> line.getAcquisitionCostSnapshot() != null)
                .map(line -> line.getAcquisitionCostSnapshot().multiply(BigDecimal.valueOf(line.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (cogsTotal.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        Optional<Account> cogs = accountRepository.findByCodeAndDeletedFalse(COGS_ACCOUNT_CODE);
        Optional<Account> inventory = accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE);
        if (cogs.isEmpty() || inventory.isEmpty()) {
            log.warn("Skipping COGS auto-journal for PoS sale {}: missing well-known account(s) {}/{}",
                    sale.getSaleNumber(), COGS_ACCOUNT_CODE, INVENTORY_ACCOUNT_CODE);
            return;
        }

        JournalEntryLineDTO debitLine = new JournalEntryLineDTO();
        debitLine.setAccountId(cogs.get().getId());
        debitLine.setDebit(cogsTotal);
        debitLine.setCredit(BigDecimal.ZERO);
        debitLine.setDescription("COGS - PoS Sale " + sale.getSaleNumber());

        JournalEntryLineDTO creditLine = new JournalEntryLineDTO();
        creditLine.setAccountId(inventory.get().getId());
        creditLine.setDebit(BigDecimal.ZERO);
        creditLine.setCredit(cogsTotal);
        creditLine.setDescription("Inventory - PoS Sale " + sale.getSaleNumber());

        JournalEntryDTO entry = new JournalEntryDTO();
        entry.setEntryDate(LocalDate.now());
        entry.setDescription("Auto-generated: PoS Sale " + sale.getSaleNumber() + " (COGS)");
        entry.setReference(sale.getSaleNumber());
        entry.setLines(List.of(debitLine, creditLine));

        // CRITICAL FIX 3: see postRevenueEntry above - same REQUIRES_NEW isolation.
        nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
    }

    // count()-based sequence has no locking, so two concurrent PoS sale creations (e.g. parallel
    // Playwright workers) can read the same count and produce the same number - append a random
    // hex suffix so the number is unique by construction even when that race happens.
    private String generateSaleNumber() {
        String prefix = "POS-" + LocalDate.now().getYear() + "-";
        long count = posSaleRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }

    private PosSaleDto toDto(PosSale sale) {
        PosSaleDto dto = new PosSaleDto();
        dto.setId(sale.getId());
        dto.setSaleNumber(sale.getSaleNumber());
        dto.setClientSaleId(sale.getClientSaleId());
        dto.setMemberId(sale.getMemberId());
        dto.setVoucherCode(sale.getVoucherCode());
        dto.setPaymentMethod(sale.getPaymentMethod());
        dto.setSubtotal(sale.getSubtotal());
        dto.setDiscountTotal(sale.getDiscountTotal());
        dto.setTotal(sale.getTotal());
        dto.setAmountTendered(sale.getAmountTendered());
        dto.setChange(sale.getChange());
        dto.setPointsEarned(sale.getPointsEarned());
        dto.setCreatedAt(sale.getCreatedAt());
        dto.setUpdatedAt(sale.getUpdatedAt());
        dto.setCreatedBy(sale.getCreatedBy());
        dto.setLines(sale.getLines().stream().map(this::toLineDto).collect(Collectors.toList()));
        dto.setTradeInId(sale.getTradeInId());
        dto.setTradeInValueApplied(sale.getTradeInValueApplied());
        dto.setStoreCreditRedeemed(sale.getStoreCreditRedeemed());
        dto.setNetCashDirection(sale.getNetCashDirection());
        dto.setNetCashAmount(sale.getNetCashAmount());
        dto.setTradeInStoreCreditGranted(sale.getTradeInStoreCreditGranted());
        dto.setStatus(sale.getStatus());
        dto.setVoidedAt(sale.getVoidedAt());
        dto.setVoidedBy(sale.getVoidedBy());
        dto.setVoidReason(sale.getVoidReason());
        return dto;
    }

    private PosSaleLineDto toLineDto(PosSaleLine line) {
        PosSaleLineDto dto = new PosSaleLineDto();
        dto.setId(line.getId());
        dto.setProductId(line.getProductId());
        dto.setProductName(line.getProductName());
        dto.setQuantity(line.getQuantity());
        dto.setUnitPrice(line.getUnitPrice());
        dto.setLineDiscount(line.getLineDiscount());
        dto.setLineTotal(line.getLineTotal());
        dto.setAcquisitionCostSnapshot(line.getAcquisitionCostSnapshot());
        return dto;
    }
}
