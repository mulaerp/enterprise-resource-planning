package com.mulaerp.shop.order.service;

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
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.product.service.ProductService;
import com.mulaerp.shop.dto.ShopCustomerDto;
import com.mulaerp.shop.entity.ShopCustomer;
import com.mulaerp.shop.order.dto.FulfilOrderRequest;
import com.mulaerp.shop.order.dto.PlaceShopOrderRequest;
import com.mulaerp.shop.order.dto.ShopOrderDto;
import com.mulaerp.shop.order.dto.ShopOrderLineRequest;
import com.mulaerp.shop.order.dto.VoidShopOrderResponseDto;
import com.mulaerp.shop.order.entity.ShopOrder;
import com.mulaerp.shop.order.entity.ShopOrderLine;
import com.mulaerp.shop.order.repository.ShopOrderRepository;
import com.mulaerp.shop.repository.ShopCustomerRepository;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import com.mulaerp.warranty.entity.Warranty;
import com.mulaerp.warranty.repository.WarrantyRepository;
import com.mulaerp.warranty.service.WarrantyService;
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
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * WEBSHOP task: online order placement (member or guest), reservation semantics, staff
 * fulfilment, and the expiry release job. See the class-level javadoc on {@link ShopOrder} for
 * the status lifecycle and {@link #fulfilOrder} below for the full reservation-vs-fulfilment
 * ledger model.
 *
 * <h2>Reservation semantics (owner decision 2)</h2>
 * Placing an order validates and decrements stock immediately (one {@code SHOP_RESERVE} movement
 * per line, negative delta, reference = the order number) - most thrift stock is quantity 1, so a
 * second shopper must never be able to add the same one-of-a-kind unit to their cart and check
 * out. No revenue journal is posted at this point - nothing has been sold yet, only reserved.
 * {@code reservedUntil} is stamped {@code now + mulaerp.shop.reservation-hours}; both cancelling
 * (customer or staff) and the release job below return the stock the same way ({@code
 * SHOP_RELEASE}, positive delta).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShopOrderService {

    private static final String SALES_REVENUE_ACCOUNT_CODE = "4100";
    private static final String COGS_ACCOUNT_CODE = "5100";
    private static final String INVENTORY_ACCOUNT_CODE = "1130";

    private final ShopOrderRepository shopOrderRepository;
    private final ShopCustomerRepository shopCustomerRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;
    private final StockMovementService stockMovementService;
    private final MemberService memberService;
    private final AccountRepository accountRepository;
    private final AccountingService accountingService;
    private final CashAccountResolver cashAccountResolver;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;
    private final WarrantyRepository warrantyRepository;
    private final WarrantyService warrantyService;

    @Value("${mulaerp.shop.order.reservation-hours:48}")
    private int reservationHours;

    @Value("${mulaerp.shop.order.delivery-fee:0.00}")
    private BigDecimal deliveryFee;

    /** V42 (Gap C): how many days after FULFILMENT an order may still be voided - mirrors
     * mulaerp.pos.void-window-days, measured from fulfilledAt rather than createdAt (see
     * ShopOrder#fulfilledAt's javadoc for why). */
    @Value("${mulaerp.shop.void-window-days:7}")
    private int voidWindowDays;

    // ==== Placement (member or guest) =======================================================

    /**
     * Places an order and immediately reserves stock for every line. {@code customer} is null for
     * a GUEST checkout (in which case {@code request.guestEmail}/{@code guestName}/{@code
     * guestPhone} are all required - 400 otherwise) and non-null for a signed-in customer (in
     * which case the guest fields are ignored, identity comes from the session).
     *
     * <p>Every order is created {@code PAY_AT_COLLECTION} today (owner decision 1 - no real
     * gateway exists yet, see {@code com.mulaerp.shop.payment}) and moves straight from creation
     * to {@code RESERVED} within this one transaction - {@code PENDING} exists in the schema for a
     * future flow (e.g. a gateway checkout redirect created before reservation completes) but is
     * never actually persisted by this method today.
     *
     * <p>Line pricing (unitPrice) is always the product's current {@code unitPrice} at the moment
     * of placement, computed server-side - the request only supplies productId/quantity, never a
     * price, so a tampered client payload cannot under-charge.
     */
    @Transactional
    public ShopOrderDto placeOrder(PlaceShopOrderRequest request, ShopCustomerDto customer) {
        boolean isGuest = customer == null;
        validatePlacement(request, isGuest);

        List<Product> products = new ArrayList<>();
        for (ShopOrderLineRequest item : request.getItems()) {
            Product product = productRepository.findByIdAndDeletedFalse(item.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + item.getProductId()));
            products.add(product);
        }

        String orderNumber = generateOrderNumber();
        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();

        List<ShopOrderLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (int i = 0; i < products.size(); i++) {
            Product product = products.get(i);
            int quantity = request.getItems().get(i).getQuantity();

            // 409 Conflict (IllegalStateException), not 400 - "someone already has the last unit"
            // is a business/availability conflict, not malformed input (see the task's explicit
            // oversell-prevention verification case).
            if (product.getStockQuantity() < quantity) {
                throw new IllegalStateException(String.format(
                        "Insufficient stock for %s (%s): requested %d, available %d",
                        product.getName(), product.getSku(), quantity, product.getStockQuantity()));
            }

            product.setStockQuantity(product.getStockQuantity() - quantity);
            productRepository.save(product);
            warehouseStockService.decrementValidated(mainWarehouseId, product, quantity);
            // Product mutated directly (not via ProductService.updateProduct) - evict the Redis
            // cache explicitly, same requirement as every other direct-mutation stock path.
            productService.evictProductCache(product.getId());
            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.SHOP_RESERVE,
                    -quantity, orderNumber, "Reserved for online order " + orderNumber);

            BigDecimal unitPrice = product.getUnitPrice();
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
            subtotal = subtotal.add(lineTotal);

            ShopOrderLine line = new ShopOrderLine();
            line.setProductId(product.getId());
            line.setProductName(product.getName());
            line.setSku(product.getSku());
            line.setQuantity(quantity);
            line.setUnitPrice(unitPrice);
            line.setLineTotal(lineTotal);
            line.setAcquisitionCostSnapshot(product.getAcquisitionCost());
            lines.add(line);
        }

        BigDecimal appliedDeliveryFee = request.getFulfilmentType() == ShopOrder.FulfilmentType.POST
                ? deliveryFee : BigDecimal.ZERO;
        BigDecimal total = subtotal.add(appliedDeliveryFee);

        ShopOrder order = new ShopOrder();
        order.setOrderNumber(orderNumber);
        if (isGuest) {
            order.setGuestEmail(request.getGuestEmail().trim().toLowerCase());
            order.setGuestName(request.getGuestName().trim());
            order.setGuestPhone(request.getGuestPhone().trim());
        } else {
            order.setShopCustomerId(customer.getId());
        }
        order.setFulfilmentType(request.getFulfilmentType());
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setStatus(ShopOrder.OrderStatus.RESERVED);
        order.setPaymentMethod(ShopOrder.PaymentMethod.PAY_AT_COLLECTION);
        order.setSubtotal(subtotal);
        order.setDeliveryFee(appliedDeliveryFee);
        order.setTotal(total);
        order.setReservedUntil(LocalDateTime.now().plusHours(reservationHours));
        order.setNotes(request.getNotes());
        lines.forEach(order::addLine);

        ShopOrder saved = shopOrderRepository.save(order);
        return ShopOrderDto.fromEntity(saved);
    }

    private void validatePlacement(PlaceShopOrderRequest request, boolean isGuest) {
        if (request.getFulfilmentType() == ShopOrder.FulfilmentType.POST && isBlank(request.getDeliveryAddress())) {
            throw new IllegalArgumentException("deliveryAddress is required when fulfilmentType is POST");
        }
        if (isGuest && (isBlank(request.getGuestEmail()) || isBlank(request.getGuestName()) || isBlank(request.getGuestPhone()))) {
            throw new IllegalArgumentException("guestEmail, guestName and guestPhone are all required for a guest checkout");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    // Same collision-safe generator pattern as SalesOrderService/InvoiceService: a count()-based
    // sequence has no locking, so a random hex suffix makes the number unique by construction even
    // if two concurrent placements read the same count.
    private String generateOrderNumber() {
        String prefix = "WEB-" + LocalDate.now().getYear() + "-";
        long count = shopOrderRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }

    // ==== Customer-facing reads/cancel =======================================================

    @Transactional(readOnly = true)
    public Page<ShopOrderDto> getOwnOrders(UUID shopCustomerId, Pageable pageable) {
        return toDtoPageWithWarranties(shopOrderRepository.findByShopCustomerId(shopCustomerId, pageable));
    }

    @Transactional(readOnly = true)
    public ShopOrderDto getOwnOrder(UUID shopCustomerId, UUID orderId) {
        ShopOrder order = getOrThrow(orderId);
        requireOwnership(order, shopCustomerId);
        return toDtoWithWarranties(order);
    }

    @Transactional
    public ShopOrderDto cancelOwnOrder(UUID shopCustomerId, UUID orderId) {
        ShopOrder order = getOrThrow(orderId);
        requireOwnership(order, shopCustomerId);
        cancelInternal(order, "Cancelled by customer");
        return ShopOrderDto.fromEntity(order);
    }

    private void requireOwnership(ShopOrder order, UUID shopCustomerId) {
        if (!Objects.equals(order.getShopCustomerId(), shopCustomerId)) {
            throw new AccessDeniedException("This order does not belong to you");
        }
    }

    // ==== Guest checkout/lookup ===============================================================

    @Transactional
    public ShopOrderDto placeGuestOrder(PlaceShopOrderRequest request) {
        return placeOrder(request, null);
    }

    /** The "lookup token" a guest needs is simply the order number returned by
     * {@link #placeGuestOrder} - paired with the email they themselves supplied, it's enough to
     * look up status without exposing anything beyond what the guest already gave us, and avoids
     * inventing a second secret to manage. A non-matching order number/email pair 404s either way
     * (order genuinely not found, or found but the email doesn't match) - this deliberately does
     * not distinguish the two so a guessed order number can't be used to probe for a valid one. */
    @Transactional(readOnly = true)
    public ShopOrderDto guestLookup(String orderNumber, String email) {
        if (isBlank(email)) {
            throw new IllegalArgumentException("email is required");
        }
        ShopOrder order = shopOrderRepository.findByOrderNumberAndGuestEmailIgnoreCase(orderNumber.trim(), email.trim())
                .orElseThrow(() -> new ResourceNotFoundException("No order found for that order number and email"));
        return toDtoWithWarranties(order);
    }

    // ==== Staff (admin) ========================================================================

    @Transactional(readOnly = true)
    public Page<ShopOrderDto> adminList(ShopOrder.OrderStatus status, ShopOrder.FulfilmentType fulfilmentType, Pageable pageable) {
        Specification<ShopOrder> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (fulfilmentType != null) {
                predicates.add(cb.equal(root.get("fulfilmentType"), fulfilmentType));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return toDtoPageWithWarranties(shopOrderRepository.findAll(spec, pageable));
    }

    @Transactional(readOnly = true)
    public ShopOrderDto adminGet(UUID orderId) {
        return toDtoWithWarranties(getOrThrow(orderId));
    }

    @Transactional
    public ShopOrderDto markReady(UUID orderId) {
        ShopOrder order = getOrThrow(orderId);
        if (order.getStatus() != ShopOrder.OrderStatus.RESERVED) {
            throw new IllegalStateException("Only a RESERVED order can be marked READY (current status: " + order.getStatus() + ")");
        }
        order.setStatus(ShopOrder.OrderStatus.READY);
        return ShopOrderDto.fromEntity(shopOrderRepository.save(order));
    }

    @Transactional
    public ShopOrderDto cancelAdmin(UUID orderId) {
        ShopOrder order = getOrThrow(orderId);
        cancelInternal(order, "Cancelled by staff");
        return ShopOrderDto.fromEntity(order);
    }

    private void cancelInternal(ShopOrder order, String note) {
        if (order.getStatus() != ShopOrder.OrderStatus.RESERVED && order.getStatus() != ShopOrder.OrderStatus.AWAITING_PAYMENT) {
            throw new IllegalStateException(
                    "Only a RESERVED or AWAITING_PAYMENT order can be cancelled (current status: " + order.getStatus() + ")");
        }
        releaseReservation(order, note);
        order.setStatus(ShopOrder.OrderStatus.CANCELLED);
        shopOrderRepository.save(order);
    }

    /**
     * Converts a reservation into a completed sale: handover to the customer (COLLECT) or
     * dispatch (POST). Gated at the controller level to {@code RoleRules}'s cashier-inclusive
     * constant (see {@code ShopOrderAdminController}/{@code RoleRules.SHOP_ORDER_STAFF}) -
     * deliberately not manager-only, because a cashier handing over a collected order at the till
     * must be able to close it out without waiting for a manager.
     *
     * <h2>Ledger model (the key design decision of this task)</h2>
     * <b>Stock: no movement is written here.</b> The {@code SHOP_RESERVE} movement written at
     * placement already removed this stock from {@code Product.stockQuantity}/{@code
     * warehouse_stock} - fulfilment does not touch stock a second time (that would double-decrement
     * against a unit that already left inventory the moment it was reserved). The ledger's
     * "truth" for this unit's departure from stock is, and remains, that original {@code
     * SHOP_RESERVE} row; {@code stock_movements} only gains new rows here in the sense that it
     * gains none - the absence of a second movement is itself the correct model. Contrast with a
     * cancelled/expired reservation, which DOES write a new {@code SHOP_RELEASE} row (see
     * {@link #releaseReservation}) because that path genuinely returns the unit to available
     * stock.
     * <p><b>Money: revenue + COGS are posted for the first time here</b> (never at placement -
     * nothing had been sold yet). Cash leg resolved by payment method: {@code PAY_AT_COLLECTION}
     * (the only reachable method today - owner decision 1) is treated as {@code CASH} through
     * {@link CashAccountResolver} (account 1111) - the cashier is assumed to take physical
     * payment at handover; a future enabled gateway would resolve to a clearing account instead
     * once {@code GATEWAY} orders exist.
     * <p><b>Loyalty: points accrue, store credit may be redeemed, ONLY for a member-linked
     * customer</b> - a {@link ShopOrder#getShopCustomerId()} whose {@code ShopCustomer.memberId}
     * is set. A guest order, or a signed-in customer never linked to a loyalty member, gets
     * neither (and a positive {@code storeCreditRedeemed} on such an order is rejected, 400).
     */
    @Transactional
    public ShopOrderDto fulfilOrder(UUID orderId, FulfilOrderRequest request) {
        ShopOrder order = getOrThrow(orderId);
        if (order.getStatus() != ShopOrder.OrderStatus.RESERVED && order.getStatus() != ShopOrder.OrderStatus.READY) {
            throw new IllegalStateException(
                    "Only a RESERVED or READY order can be fulfilled (current status: " + order.getStatus() + ")");
        }

        UUID memberId = order.getShopCustomerId() != null
                ? shopCustomerRepository.findById(order.getShopCustomerId()).map(ShopCustomer::getMemberId).orElse(null)
                : null;

        BigDecimal storeCreditRedeemed = request != null && request.getStoreCreditRedeemed() != null
                ? request.getStoreCreditRedeemed() : BigDecimal.ZERO;
        if (storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0 && memberId == null) {
            throw new IllegalArgumentException(
                    "Store credit can only be redeemed against an order placed by a member-linked customer");
        }
        // Courtesy clamp (never redeem more than the order needs) - MemberService#debitStoreCredit
        // is the authoritative overdraft guard, same division of responsibility as PosSaleService.
        if (storeCreditRedeemed.compareTo(order.getTotal()) > 0) {
            storeCreditRedeemed = order.getTotal();
        }
        if (storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0) {
            memberService.debitStoreCredit(memberId, storeCreditRedeemed);
        }

        // Points earned on the full value of goods+delivery sold, same "on the sale value, not
        // net cash flow" rule as PoS - a member who redeems store credit still earns points on
        // the whole order. Computed and snapshotted onto the order itself (V42) BEFORE save, so
        // #voidOrder can later deduct back exactly this many without recomputing it from a total
        // that hasn't changed but shouldn't be re-derived twice.
        int pointsEarned = memberId != null ? order.getTotal().setScale(0, RoundingMode.FLOOR).intValue() : 0;

        order.setStatus(ShopOrder.OrderStatus.FULFILLED);
        order.setFulfilledAt(LocalDateTime.now());
        order.setStoreCreditRedeemed(storeCreditRedeemed);
        order.setPointsEarned(pointsEarned);
        ShopOrder saved = shopOrderRepository.save(order);

        BigDecimal finalStoreCreditRedeemed = storeCreditRedeemed;
        try {
            postRevenueEntry(saved, finalStoreCreditRedeemed);
        } catch (Exception e) {
            log.warn("Failed to create revenue auto-journal for shop order {}: {}", saved.getOrderNumber(), e.getMessage());
        }
        try {
            postCogsEntry(saved);
        } catch (Exception e) {
            log.warn("Failed to create COGS auto-journal for shop order {}: {}", saved.getOrderNumber(), e.getMessage());
        }

        if (memberId != null) {
            memberService.accruePoints(memberId, pointsEarned);
        }

        // ---- GAP B: non-blocking auto-issue, one warranty per unit whose product has
        // warrantyMonths set - never fails fulfilment (same pattern as the journal hooks above and
        // exactly mirrors PosSaleService#issueLineWarranties, reusing WarrantyService rather than
        // duplicating warranty logic). ---------------------------------------------------------
        issueLineWarranties(saved, memberId);

        return toDtoWithWarranties(saved);
    }

    /**
     * V42 (Gap B): one non-blocking hook call per line, mirroring
     * {@code PosSaleService#issueLineWarranties} exactly - per-line so one bad product/line
     * doesn't stop warranties being issued for the rest of the order, and each call runs in its
     * own REQUIRES_NEW transaction via {@link NonBlockingHookExecutor} so a genuine failure can
     * never fail fulfilment. {@code shopCustomerId} is only passed when there is no member link
     * (see WarrantyService#autoIssueForShopOrderLine's javadoc for the full attribution rule) -
     * both are null for a guest order, in which case {@code shopOrderId} alone attributes it.
     */
    private void issueLineWarranties(ShopOrder order, UUID memberId) {
        UUID shopCustomerIdForAttribution = memberId == null ? order.getShopCustomerId() : null;
        for (ShopOrderLine line : order.getLines()) {
            try {
                Product product = productRepository.findById(line.getProductId()).orElse(null);
                if (product == null) {
                    log.warn("Skipping warranty auto-issue for web order {} line (product {} no longer found)",
                            order.getOrderNumber(), line.getProductId());
                    continue;
                }
                int quantity = line.getQuantity();
                UUID orderId = order.getId();
                nonBlockingHookExecutor.runInNewTransaction(
                        () -> warrantyService.autoIssueForShopOrderLine(product, quantity, orderId, memberId, shopCustomerIdForAttribution));
            } catch (Exception e) {
                log.warn("Failed to auto-issue warranty for a line on web order {}: {}", order.getOrderNumber(), e.getMessage());
            }
        }
    }

    /** Enriches a plain {@link ShopOrderDto#fromEntity} with warranty numbers issued by this
     * order (V42, Gap B) - a single extra query, since fromEntity itself never touches the
     * database. */
    private ShopOrderDto toDtoWithWarranties(ShopOrder order) {
        ShopOrderDto dto = ShopOrderDto.fromEntity(order);
        dto.setWarrantyNumbers(warrantyRepository.findByShopOrderIdAndDeletedFalse(order.getId()).stream()
                .map(Warranty::getWarrantyNumber).collect(Collectors.toList()));
        return dto;
    }

    /** Batched form of {@link #toDtoWithWarranties} for a page of orders (adminList/getOwnOrders) -
     * one query for the whole page rather than one per row. */
    private Page<ShopOrderDto> toDtoPageWithWarranties(Page<ShopOrder> page) {
        List<UUID> orderIds = page.getContent().stream().map(ShopOrder::getId).collect(Collectors.toList());
        Map<UUID, List<String>> byOrder = orderIds.isEmpty() ? Map.of()
                : warrantyRepository.findByShopOrderIdInAndDeletedFalse(orderIds).stream()
                        .collect(Collectors.groupingBy(Warranty::getShopOrderId,
                                Collectors.mapping(Warranty::getWarrantyNumber, Collectors.toList())));
        return page.map(order -> {
            ShopOrderDto dto = ShopOrderDto.fromEntity(order);
            dto.setWarrantyNumbers(byOrder.getOrDefault(order.getId(), List.of()));
            return dto;
        });
    }

    private void postRevenueEntry(ShopOrder order, BigDecimal storeCreditRedeemed) {
        BigDecimal total = order.getTotal();
        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        BigDecimal cashAmount = total.subtract(storeCreditRedeemed);

        // PAY_AT_COLLECTION -> CASH (1111) per owner decision 1 - see this method's class-level
        // javadoc on fulfilOrder. GATEWAY is not reachable while payment.gateway.enabled=false.
        Optional<Account> cash = accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode("CASH"));
        Optional<Account> salesRevenue = accountRepository.findByCodeAndDeletedFalse(SALES_REVENUE_ACCOUNT_CODE);
        boolean needsStoreCreditLiability = storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0;
        Optional<Account> storeCreditLiability = needsStoreCreditLiability
                ? accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode("STORE_CREDIT")) : Optional.empty();

        if (cash.isEmpty() || salesRevenue.isEmpty() || (needsStoreCreditLiability && storeCreditLiability.isEmpty())) {
            log.warn("Skipping revenue auto-journal for shop order {}: missing well-known account(s)", order.getOrderNumber());
            return;
        }

        List<JournalEntryLineDTO> lines = new ArrayList<>();
        if (cashAmount.compareTo(BigDecimal.ZERO) > 0) {
            lines.add(debitLine(cash.get().getId(), cashAmount, "Cash collected - Web Order " + order.getOrderNumber()));
        }
        if (needsStoreCreditLiability) {
            lines.add(debitLine(storeCreditLiability.get().getId(), storeCreditRedeemed,
                    "Store credit redeemed - Web Order " + order.getOrderNumber()));
        }
        lines.add(creditLine(salesRevenue.get().getId(), total, "Sales Revenue - Web Order " + order.getOrderNumber()));

        JournalEntryDTO entry = new JournalEntryDTO();
        entry.setEntryDate(LocalDate.now());
        entry.setDescription("Auto-generated: Web Order " + order.getOrderNumber() + " fulfilled");
        entry.setReference(order.getOrderNumber());
        entry.setLines(lines);
        nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
    }

    private void postCogsEntry(ShopOrder order) {
        BigDecimal cogsTotal = order.getLines().stream()
                .filter(line -> line.getAcquisitionCostSnapshot() != null)
                .map(line -> line.getAcquisitionCostSnapshot().multiply(BigDecimal.valueOf(line.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (cogsTotal.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        Optional<Account> cogs = accountRepository.findByCodeAndDeletedFalse(COGS_ACCOUNT_CODE);
        Optional<Account> inventory = accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE);
        if (cogs.isEmpty() || inventory.isEmpty()) {
            log.warn("Skipping COGS auto-journal for shop order {}: missing well-known account(s) {}/{}",
                    order.getOrderNumber(), COGS_ACCOUNT_CODE, INVENTORY_ACCOUNT_CODE);
            return;
        }

        JournalEntryLineDTO debit = debitLine(cogs.get().getId(), cogsTotal, "COGS - Web Order " + order.getOrderNumber());
        JournalEntryLineDTO credit = creditLine(inventory.get().getId(), cogsTotal, "Inventory - Web Order " + order.getOrderNumber());

        JournalEntryDTO entry = new JournalEntryDTO();
        entry.setEntryDate(LocalDate.now());
        entry.setDescription("Auto-generated: Web Order " + order.getOrderNumber() + " (COGS)");
        entry.setReference(order.getOrderNumber());
        entry.setLines(List.of(debit, credit));
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

    // ==== Void (Gap C) =========================================================================

    /** created=false is not meaningful here (unlike PoS's idempotent-replay SaleResult) - a void
     * either succeeds once or throws; this record only exists to bundle everything the response
     * DTO needs. */
    public record VoidResult(
            ShopOrderDto dto,
            String refundMethod,
            BigDecimal refundAmount,
            List<VoidShopOrderResponseDto.StockReturnedItem> stockReturned,
            BigDecimal storeCreditReversed,
            Integer pointsDeducted,
            List<String> warrantiesVoided
    ) {}

    /**
     * V42 (Gap C): reverses a FULFILLED web order - stock returned (SHOP_VOID movement, see V42's
     * migration javadoc for why this is a distinct type from SHOP_RELEASE), revenue/COGS journal
     * entries reversed as SYSTEM entries (auto-posted per the same policy as every other system
     * hook), any points/store-credit tied to the order reversed, and (Gap B) every warranty this
     * order issued is VOIDed via the existing warranty void path. Mirrors
     * {@code PosSaleService#voidSale}'s structure closely: MANAGER_UP only (backed at the
     * controller, not here - a cashier must not be able to erase a completed sale unsupervised,
     * exactly the same rationale as PoS void), a configurable window
     * (mulaerp.shop.void-window-days, default 7, measured from {@code fulfilledAt}), and
     * idempotent (a second void 409s rather than double-reversing).
     *
     * <p>All validation happens before any mutation (already-voided, wrong status, void window,
     * the claimed-warranty safety check below) so a rejected void changes nothing - same
     * "impossible to partially apply" property PosSaleService#voidSale documents for its own
     * pre-mutation checks.
     *
     * <p><b>Safety refusal (mirrors PoS's "traded-in item already moved on" 409):</b> a PoS
     * part-exchange sale can have its traded-in item independently consumed downstream (resold,
     * used as a repair part); a web order's own downstream consequence is the same shape via Gap
     * B's warranty - if any warranty issued by this order has already been CLAIMED, a linked
     * RepairJob already exists against it (parts may already be consumed, payments taken). Voiding
     * the order out from under a live claim would leave that repair job pointing at a VOID
     * warranty mid-flight, so this refuses (409) instead, naming the warranty and telling staff to
     * resolve/cancel that repair job first.
     */
    @Transactional
    public VoidResult voidOrder(UUID orderId, String reason) {
        ShopOrder order = getOrThrow(orderId);

        if (order.getStatus() == ShopOrder.OrderStatus.VOIDED) {
            throw new IllegalStateException("Order " + order.getOrderNumber() + " has already been voided");
        }
        if (order.getStatus() != ShopOrder.OrderStatus.FULFILLED) {
            throw new IllegalStateException(
                    "Only a FULFILLED order can be voided (current status: " + order.getStatus() + ") - "
                            + "a RESERVED/READY order should be cancelled instead (POST .../cancel)");
        }

        LocalDateTime referenceDate = order.getFulfilledAt() != null ? order.getFulfilledAt() : order.getUpdatedAt();
        LocalDateTime cutoff = LocalDateTime.now().minusDays(voidWindowDays);
        if (referenceDate.isBefore(cutoff)) {
            throw new IllegalStateException(String.format(
                    "Order %s was fulfilled on %s, more than %d day(s) ago, and is outside the void window - "
                            + "it can no longer be voided",
                    order.getOrderNumber(), referenceDate.toLocalDate(), voidWindowDays));
        }

        // ---- Safety check: load linked warranties BEFORE any mutation - see this method's
        // javadoc for why a CLAIMED one blocks the void entirely. ------------------------------
        List<Warranty> linkedWarranties = warrantyRepository.findByShopOrderIdAndDeletedFalse(order.getId());
        Optional<Warranty> claimed = linkedWarranties.stream()
                .filter(w -> w.getStatus() == Warranty.WarrantyStatus.CLAIMED)
                .findFirst();
        if (claimed.isPresent()) {
            throw new IllegalStateException(String.format(
                    "Cannot void order %s: warranty %s issued by this order has already been claimed (a repair job "
                            + "exists against it) - resolve or cancel that repair job first, then void this order, "
                            + "or reverse the sale manually if the repair has already progressed too far to undo.",
                    order.getOrderNumber(), claimed.get().getWarrantyNumber()));
        }

        // ==== All validation passed - begin mutation ==========================================

        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();

        // ---- (a) Stock: return every line, SHOP_VOID (+qty) - the original SHOP_RESERVE row is
        // never touched (append-only ledger, same rule as every other void in this codebase). ---
        List<VoidShopOrderResponseDto.StockReturnedItem> stockReturned = new ArrayList<>();
        for (ShopOrderLine line : order.getLines()) {
            Product product = productRepository.findById(line.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + line.getProductId()));
            product.setStockQuantity(product.getStockQuantity() + line.getQuantity());
            productRepository.save(product);
            warehouseStockService.applyDelta(mainWarehouseId, product, line.getQuantity());
            productService.evictProductCache(product.getId());

            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.SHOP_VOID,
                    line.getQuantity(), order.getOrderNumber(), "Void: " + reason);
            stockReturned.add(new VoidShopOrderResponseDto.StockReturnedItem(
                    product.getId(), product.getSku(), product.getName(), line.getQuantity()));
        }

        // ---- (b) Money: reverse revenue/COGS as SYSTEM entries (auto-posted, non-blocking). ----
        createVoidJournalEntries(order);

        UUID memberId = order.getShopCustomerId() != null
                ? shopCustomerRepository.findById(order.getShopCustomerId()).map(ShopCustomer::getMemberId).orElse(null)
                : null;

        BigDecimal storeCreditReversed = BigDecimal.ZERO;
        if (order.getStoreCreditRedeemed() != null && order.getStoreCreditRedeemed().compareTo(BigDecimal.ZERO) > 0
                && memberId != null) {
            memberService.creditStoreCredit(memberId, order.getStoreCreditRedeemed());
            storeCreditReversed = order.getStoreCreditRedeemed();
        }

        Integer pointsDeducted = 0;
        if (order.getPointsEarned() != null && order.getPointsEarned() > 0 && memberId != null) {
            memberService.deductPoints(memberId, order.getPointsEarned());
            pointsDeducted = order.getPointsEarned();
        }

        // ---- (c) Gap B: VOID every warranty this order issued via the existing warranty void
        // path (WarrantyService#voidWarranty) - never left live against a cancelled sale. --------
        List<String> warrantiesVoided = new ArrayList<>();
        for (Warranty warranty : linkedWarranties) {
            if (warranty.getStatus() != Warranty.WarrantyStatus.VOID) {
                warrantyService.voidWarranty(warranty.getId());
                warrantiesVoided.add(warranty.getWarrantyNumber());
            }
        }

        // ---- Mark voided (append-only: no other column on this row changes) -------------------
        order.setStatus(ShopOrder.OrderStatus.VOIDED);
        order.setVoidedAt(LocalDateTime.now());
        order.setVoidedBy(currentUsername());
        order.setVoidReason(reason);
        ShopOrder saved = shopOrderRepository.save(order);

        // ---- Refund: PAY_AT_COLLECTION always resolved to CASH at fulfilment (see fulfilOrder's
        // javadoc) - the amount physically owed is the total minus whatever store credit covered
        // it (that portion reverses automatically above, never handed over physically). ---------
        String refundMethod = "CASH";
        BigDecimal refundAmount = saved.getTotal().subtract(storeCreditReversed);
        if (refundAmount.compareTo(BigDecimal.ZERO) < 0) {
            refundAmount = BigDecimal.ZERO;
        }

        return new VoidResult(toDtoWithWarranties(saved), refundMethod, refundAmount, stockReturned,
                storeCreditReversed, pointsDeducted, warrantiesVoided);
    }

    /**
     * Mirror of {@link #postRevenueEntry}/{@link #postCogsEntry} with debit/credit swapped -
     * reverses exactly the entries the original fulfilment posted. Same REQUIRES_NEW/try-catch
     * non-blocking pattern as every other auto-journal hook in this codebase.
     */
    private void createVoidJournalEntries(ShopOrder order) {
        try {
            BigDecimal total = order.getTotal();
            BigDecimal storeCreditRedeemed = order.getStoreCreditRedeemed() != null ? order.getStoreCreditRedeemed() : BigDecimal.ZERO;
            if (total.compareTo(BigDecimal.ZERO) <= 0) {
                return;
            }
            BigDecimal cashAmount = total.subtract(storeCreditRedeemed);

            Optional<Account> cash = accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode("CASH"));
            Optional<Account> salesRevenue = accountRepository.findByCodeAndDeletedFalse(SALES_REVENUE_ACCOUNT_CODE);
            boolean needsStoreCreditLiability = storeCreditRedeemed.compareTo(BigDecimal.ZERO) > 0;
            Optional<Account> storeCreditLiability = needsStoreCreditLiability
                    ? accountRepository.findByCodeAndDeletedFalse(cashAccountResolver.resolveCode("STORE_CREDIT")) : Optional.empty();

            if (cash.isEmpty() || salesRevenue.isEmpty() || (needsStoreCreditLiability && storeCreditLiability.isEmpty())) {
                log.warn("Skipping void revenue-reversal auto-journal for web order {}: missing well-known account(s)", order.getOrderNumber());
            } else {
                List<JournalEntryLineDTO> lines = new ArrayList<>();
                lines.add(debitLine(salesRevenue.get().getId(), total, "Void reversal: Sales Revenue - Web Order " + order.getOrderNumber()));
                if (cashAmount.compareTo(BigDecimal.ZERO) > 0) {
                    lines.add(creditLine(cash.get().getId(), cashAmount, "Void reversal: cash refunded - Web Order " + order.getOrderNumber()));
                }
                if (needsStoreCreditLiability) {
                    lines.add(creditLine(storeCreditLiability.get().getId(), storeCreditRedeemed,
                            "Void reversal: store credit reinstated - Web Order " + order.getOrderNumber()));
                }

                JournalEntryDTO entry = new JournalEntryDTO();
                entry.setEntryDate(LocalDate.now());
                entry.setDescription("Auto-generated: Void of Web Order " + order.getOrderNumber());
                entry.setReference(order.getOrderNumber());
                entry.setLines(lines);
                nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
            }
        } catch (Exception e) {
            log.warn("Failed to create void revenue-reversal auto-journal entry for web order {}: {}", order.getOrderNumber(), e.getMessage());
        }

        try {
            BigDecimal cogsTotal = order.getLines().stream()
                    .filter(line -> line.getAcquisitionCostSnapshot() != null)
                    .map(line -> line.getAcquisitionCostSnapshot().multiply(BigDecimal.valueOf(line.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (cogsTotal.compareTo(BigDecimal.ZERO) <= 0) {
                return;
            }

            Optional<Account> cogs = accountRepository.findByCodeAndDeletedFalse(COGS_ACCOUNT_CODE);
            Optional<Account> inventory = accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE);
            if (cogs.isEmpty() || inventory.isEmpty()) {
                log.warn("Skipping void COGS-reversal auto-journal for web order {}: missing well-known account(s) {}/{}",
                        order.getOrderNumber(), COGS_ACCOUNT_CODE, INVENTORY_ACCOUNT_CODE);
                return;
            }

            JournalEntryLineDTO debitInventory = debitLine(inventory.get().getId(), cogsTotal, "Void reversal: Inventory - Web Order " + order.getOrderNumber());
            JournalEntryLineDTO creditCogs = creditLine(cogs.get().getId(), cogsTotal, "Void reversal: COGS - Web Order " + order.getOrderNumber());

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Void of Web Order " + order.getOrderNumber() + " (COGS reversal)");
            entry.setReference(order.getOrderNumber());
            entry.setLines(List.of(debitInventory, creditCogs));
            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create void COGS-reversal auto-journal entry for web order {}: {}", order.getOrderNumber(), e.getMessage());
        }
    }

    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            return "system";
        }
        return authentication.getName();
    }

    // ==== Expiry release job ===================================================================

    /**
     * Releases every order still holding stock hostage past its reservation window: status ->
     * EXPIRED, stock returned line-by-line with a {@code SHOP_RELEASE} movement (same mechanism as
     * an immediate cancel). Called on a schedule (see {@code ShopOrderReservationScheduler}) and
     * also directly from a manual staff-triggered admin endpoint for ops/verification use.
     */
    @Transactional
    public int releaseExpiredReservations() {
        List<ShopOrder> expired = shopOrderRepository.findByStatusInAndReservedUntilBefore(
                List.of(ShopOrder.OrderStatus.RESERVED, ShopOrder.OrderStatus.AWAITING_PAYMENT), LocalDateTime.now());
        for (ShopOrder order : expired) {
            releaseReservation(order, "Reservation expired");
            order.setStatus(ShopOrder.OrderStatus.EXPIRED);
            shopOrderRepository.save(order);
        }
        return expired.size();
    }

    private void releaseReservation(ShopOrder order, String note) {
        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();
        for (ShopOrderLine line : order.getLines()) {
            Product product = productRepository.findById(line.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + line.getProductId()));
            product.setStockQuantity(product.getStockQuantity() + line.getQuantity());
            productRepository.save(product);
            warehouseStockService.applyDelta(mainWarehouseId, product, line.getQuantity());
            productService.evictProductCache(product.getId());
            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.SHOP_RELEASE,
                    line.getQuantity(), order.getOrderNumber(), note);
        }
    }

    private ShopOrder getOrThrow(UUID orderId) {
        return shopOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
    }
}
