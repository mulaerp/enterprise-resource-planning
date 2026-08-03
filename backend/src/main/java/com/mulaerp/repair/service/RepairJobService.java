package com.mulaerp.repair.service;

import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.service.AccountingService;
import com.mulaerp.accounting.service.CashAccountResolver;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.member.entity.Member;
import com.mulaerp.member.repository.MemberRepository;
import com.mulaerp.member.service.MemberService;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.product.service.ProductService;
import com.mulaerp.repair.dto.AddRepairPartRequest;
import com.mulaerp.repair.dto.CreateRepairPaymentRequest;
import com.mulaerp.repair.dto.CreateRepairRequest;
import com.mulaerp.repair.dto.RefundRepairPaymentRequest;
import com.mulaerp.repair.dto.RepairJobDto;
import com.mulaerp.repair.dto.RepairPartDto;
import com.mulaerp.repair.dto.RepairPaymentDto;
import com.mulaerp.repair.dto.UpdateRepairRequest;
import com.mulaerp.repair.entity.RepairJob;
import com.mulaerp.repair.entity.RepairPart;
import com.mulaerp.repair.entity.RepairPayment;
import com.mulaerp.repair.repository.RepairJobRepository;
import com.mulaerp.repair.repository.RepairPartRepository;
import com.mulaerp.repair.repository.RepairPaymentRepository;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import com.mulaerp.warranty.entity.Warranty;
import com.mulaerp.warranty.repository.WarrantyRepository;
import com.mulaerp.warranty.service.WarrantyService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
 * Repair-shop job tickets - paid walk-in repairs and no-charge warranty claims (see
 * #createForWarrantyClaim, called from WarrantyService#claimWarranty). Status transitions are
 * restricted to a fixed forward graph (see ALLOWED_TRANSITIONS).
 *
 * <p>WP: parts (repair_parts) are earmarked while a job is being quoted/approved and only
 * actually decremented from stock at the IN_REPAIR transition (#consumePartsForRepair), reversed
 * if the job is then cancelled from IN_REPAIR (#reverseConsumedParts) - both post a COGS/Inventory
 * journal that runs even for a warranty claim (the shop still bears the parts cost). Payments
 * (repair_payments) accumulate towards totalCost; COLLECTED is rejected (409) if they don't cover
 * it yet (skipped for a warranty claim, whose totalCost is always 0), and posts the aggregate
 * revenue-recognition journal (#createCollectionJournalEntry) plus a non-blocking workmanship
 * warranty (#issueWorkmanshipWarranty, WarrantyService injected via ObjectProvider to break the
 * RepairJobService <-> WarrantyService constructor cycle - WarrantyService already depends on
 * RepairJobService for #createForWarrantyClaim).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RepairJobService {

    private static final String SERVICE_REVENUE_ACCOUNT_CODE = "4200";
    private static final String COGS_ACCOUNT_CODE = "5100";
    private static final String INVENTORY_ACCOUNT_CODE = "1130";
    private static final String CUSTOMER_DEPOSITS_ACCOUNT_CODE = "2150";

    /** WP (cash-leg split): fixed, deterministic order in which #createCollectionJournalEntry
     * applies each payment method's balance/full payments against the remaining totalCost - any
     * order is mathematically fine (the waterfall clamps each step to whatever remains), this one
     * just matches ALLOWED_PAYMENT_METHODS' declaration order for readability. */
    private static final List<String> COLLECTION_METHOD_ORDER = List.of("CASH", "CARD", "EWALLET", "STORE_CREDIT");

    private static final Set<String> ALLOWED_PAYMENT_METHODS = Set.of("CASH", "CARD", "EWALLET", "STORE_CREDIT");

    /** Parts can only be added/removed before the job has entered IN_REPAIR (stock consumption
     * happens exactly once, at that transition). */
    private static final Set<RepairJob.RepairStatus> PARTS_EDITABLE_STATUSES = Set.of(
            RepairJob.RepairStatus.RECEIVED, RepairJob.RepairStatus.DIAGNOSED,
            RepairJob.RepairStatus.AWAITING_APPROVAL, RepairJob.RepairStatus.APPROVED);

    /** Fixed forward transition graph - anything not listed here is rejected as 409. */
    private static final Map<RepairJob.RepairStatus, Set<RepairJob.RepairStatus>> ALLOWED_TRANSITIONS = Map.of(
            RepairJob.RepairStatus.RECEIVED, Set.of(RepairJob.RepairStatus.DIAGNOSED, RepairJob.RepairStatus.CANCELLED),
            RepairJob.RepairStatus.DIAGNOSED, Set.of(RepairJob.RepairStatus.AWAITING_APPROVAL, RepairJob.RepairStatus.IN_REPAIR, RepairJob.RepairStatus.CANCELLED),
            RepairJob.RepairStatus.AWAITING_APPROVAL, Set.of(RepairJob.RepairStatus.APPROVED, RepairJob.RepairStatus.CANCELLED),
            RepairJob.RepairStatus.APPROVED, Set.of(RepairJob.RepairStatus.IN_REPAIR, RepairJob.RepairStatus.CANCELLED),
            RepairJob.RepairStatus.IN_REPAIR, Set.of(RepairJob.RepairStatus.COMPLETED, RepairJob.RepairStatus.CANCELLED),
            RepairJob.RepairStatus.COMPLETED, Set.of(RepairJob.RepairStatus.COLLECTED),
            RepairJob.RepairStatus.COLLECTED, Set.of(),
            RepairJob.RepairStatus.CANCELLED, Set.of()
    );

    private final RepairJobRepository repairJobRepository;
    private final RepairPartRepository repairPartRepository;
    private final RepairPaymentRepository repairPaymentRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;
    private final StockMovementService stockMovementService;
    private final WarrantyRepository warrantyRepository;
    private final ObjectProvider<WarrantyService> warrantyServiceProvider;
    private final AccountingService accountingService;
    private final AccountRepository accountRepository;
    private final CashAccountResolver cashAccountResolver;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;
    private final CustomerRepository customerRepository;
    private final MemberRepository memberRepository;
    private final MemberService memberService;

    @Value("${mulaerp.repair.warranty-months:1}")
    private int repairWarrantyMonths;

    @Transactional(readOnly = true)
    public Page<RepairJobDto> getAllRepairs(String status, String search, Pageable pageable) {
        RepairJob.RepairStatus statusFilter = parseStatus(status);
        Specification<RepairJob> spec = buildSpecification(statusFilter, search);
        return repairJobRepository.findAll(spec, pageable).map(RepairJobDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public RepairJobDto getRepairById(UUID id) {
        return toDtoWithDetails(getEntity(id));
    }

    @Transactional
    public RepairJobDto createRepair(CreateRepairRequest request) {
        RepairJob job = new RepairJob();
        job.setJobNumber(generateJobNumber());
        job.setCustomerId(request.getCustomerId());
        job.setWalkInName(request.getWalkInName());
        job.setWalkInPhone(request.getWalkInPhone());
        job.setProductId(request.getProductId());
        job.setSerialNumber(request.getSerialNumber());
        job.setDeviceDescription(request.getDeviceDescription());
        job.setReportedFault(request.getReportedFault());
        job.setNotes(request.getNotes());
        job.setStatus(RepairJob.RepairStatus.RECEIVED);
        job.setReceivedAt(LocalDateTime.now());
        job.setIsWarrantyClaim(false);
        recomputeTotalCost(job);

        return toDtoWithDetails(repairJobRepository.save(job));
    }

    /**
     * Called from WarrantyService#claimWarranty - a no-charge repair job (isWarrantyClaim=true,
     * totalCost forced to 0 regardless of any cost fields later set on it) linked back to the
     * warranty that spawned it.
     */
    @Transactional
    public RepairJobDto createForWarrantyClaim(Warranty warranty, String reportedFault) {
        RepairJob job = new RepairJob();
        job.setJobNumber(generateJobNumber());
        job.setCustomerId(warranty.getCustomerId());
        job.setProductId(warranty.getProductId());
        job.setDeviceDescription(warranty.getProductName());
        job.setReportedFault(reportedFault);
        job.setStatus(RepairJob.RepairStatus.RECEIVED);
        job.setReceivedAt(LocalDateTime.now());
        job.setWarrantyId(warranty.getId());
        job.setIsWarrantyClaim(true);
        recomputeTotalCost(job);

        return toDtoWithDetails(repairJobRepository.save(job));
    }

    @Transactional
    public RepairJobDto updateRepair(UUID id, UpdateRepairRequest request) {
        RepairJob job = getEntity(id);

        if (request.getVersion() != null && !request.getVersion().equals(job.getVersion())) {
            throw new ObjectOptimisticLockingFailureException(RepairJob.class, id);
        }

        job.setDiagnosis(request.getDiagnosis());
        job.setQuoteAmount(request.getQuoteAmount());
        job.setPartsCost(request.getPartsCost());
        job.setLabourCost(request.getLabourCost());
        job.setNotes(request.getNotes());
        job.setPromisedDate(request.getPromisedDate());
        recomputeTotalCost(job);

        RepairJob updated = repairJobRepository.saveAndFlush(job);
        return toDtoWithDetails(updated);
    }

    @Transactional
    public RepairJobDto updateStatus(UUID id, String statusParam) {
        RepairJob job = getEntity(id);

        RepairJob.RepairStatus newStatus;
        try {
            newStatus = RepairJob.RepairStatus.valueOf(statusParam.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown repair status: " + statusParam);
        }

        RepairJob.RepairStatus current = job.getStatus();
        Set<RepairJob.RepairStatus> allowed = ALLOWED_TRANSITIONS.getOrDefault(current, Set.of());
        if (current != newStatus && !allowed.contains(newStatus)) {
            throw new IllegalStateException(
                    "Cannot transition repair job from " + current + " to " + newStatus);
        }

        if (newStatus == RepairJob.RepairStatus.APPROVED) {
            job.setApprovedAt(LocalDateTime.now());
        }

        // WP: consume repair_parts stock exactly once, at the IN_REPAIR transition - blocking
        // (not non-blocking): insufficient stock must fail the transition itself, same as any
        // other stock mutation in this codebase.
        if (newStatus == RepairJob.RepairStatus.IN_REPAIR) {
            consumePartsForRepair(job);
        }

        // WP: IN_REPAIR -> CANCELLED reverses whatever was consumed above - `current ==
        // IN_REPAIR` reliably means consumption already happened (if the job had any parts),
        // since IN_REPAIR is only ever entered once in the forward-only transition graph.
        if (current == RepairJob.RepairStatus.IN_REPAIR && newStatus == RepairJob.RepairStatus.CANCELLED) {
            reverseConsumedParts(job);
        }

        if (newStatus == RepairJob.RepairStatus.COLLECTED) {
            guardFullyPaidUnlessWarrantyClaim(job);
        }

        job.setStatus(newStatus);
        if (newStatus == RepairJob.RepairStatus.COMPLETED) {
            job.setCompletedAt(LocalDateTime.now());
        }
        if (newStatus == RepairJob.RepairStatus.COLLECTED) {
            job.setCollectedAt(LocalDateTime.now());
        }

        RepairJob saved = repairJobRepository.save(job);

        if (newStatus == RepairJob.RepairStatus.COLLECTED) {
            createCollectionJournalEntry(saved);
            issueWorkmanshipWarranty(saved);
        }

        return toDtoWithDetails(saved);
    }

    // ============================================================================================
    // Repair parts
    // ============================================================================================

    @Transactional
    public RepairJobDto addPart(UUID repairId, AddRepairPartRequest request) {
        RepairJob job = getEntity(repairId);
        guardPartsEditable(job);

        Product product = productRepository.findByIdAndDeletedFalse(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + request.getProductId()));

        RepairPart part = new RepairPart();
        part.setRepairJobId(job.getId());
        part.setProductId(product.getId());
        part.setProductName(product.getName());
        part.setQuantity(request.getQuantity());
        part.setUnitCost(costBasis(product));
        repairPartRepository.save(part);

        recomputeTotalCost(job);
        RepairJob saved = repairJobRepository.save(job);
        return toDtoWithDetails(saved);
    }

    @Transactional
    public RepairJobDto removePart(UUID repairId, UUID partId) {
        RepairJob job = getEntity(repairId);
        guardPartsEditable(job);

        RepairPart part = repairPartRepository.findById(partId)
                .filter(p -> p.getRepairJobId().equals(job.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Repair part not found: " + partId));
        repairPartRepository.delete(part);

        recomputeTotalCost(job);
        RepairJob saved = repairJobRepository.save(job);
        return toDtoWithDetails(saved);
    }

    private void guardPartsEditable(RepairJob job) {
        if (!PARTS_EDITABLE_STATUSES.contains(job.getStatus())) {
            throw new IllegalStateException(
                    "Repair parts can only be added or removed before the job enters IN_REPAIR (current status: "
                            + job.getStatus() + ")");
        }
    }

    /** Same cost-basis priority as PosSaleService#priceFloor: costPrice if set, else acquisitionCost. */
    private BigDecimal costBasis(Product product) {
        boolean costPriceSet = product.getCostPrice() != null && product.getCostPrice().compareTo(BigDecimal.ZERO) > 0;
        if (costPriceSet) {
            return product.getCostPrice();
        }
        return product.getAcquisitionCost() != null ? product.getAcquisitionCost() : BigDecimal.ZERO;
    }

    /**
     * WP: consumes stock for every repair_parts row exactly once - insufficient stock fails the
     * IN_REPAIR transition itself (blocking, unlike the journal posting below it). Posts a single
     * Dr COGS / Cr Inventory journal for the total, non-blocking, unconditionally (even for a
     * warranty claim - the shop bears the cost regardless of whether the customer is charged).
     */
    private void consumePartsForRepair(RepairJob job) {
        List<RepairPart> parts = repairPartRepository.findByRepairJobIdOrderByCreatedAtAsc(job.getId());
        if (parts.isEmpty()) {
            return;
        }

        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();
        BigDecimal cogsTotal = BigDecimal.ZERO;
        for (RepairPart part : parts) {
            Product product = productRepository.findByIdAndDeletedFalse(part.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + part.getProductId()));
            int quantity = part.getQuantity();
            if (product.getStockQuantity() - quantity < 0) {
                throw new IllegalArgumentException(String.format(
                        "Insufficient stock for repair part %s: available %d, requested %d",
                        product.getSku(), product.getStockQuantity(), quantity));
            }

            product.setStockQuantity(product.getStockQuantity() - quantity);
            productRepository.save(product);
            warehouseStockService.decrementValidated(mainWarehouseId, product, quantity);
            productService.evictProductCache(product.getId());
            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.REPAIR_PART_CONSUMED,
                    -quantity, job.getJobNumber(), "Consumed for repair");

            cogsTotal = cogsTotal.add(part.getUnitCost().multiply(BigDecimal.valueOf(quantity)));
        }

        postPartsCogsJournalEntry(job, cogsTotal, false);
    }

    /** WP: re-increments stock for every repair_parts row and posts the reversing journal - see
     * the `current == IN_REPAIR` guard at the call site for why this only ever runs once. */
    private void reverseConsumedParts(RepairJob job) {
        List<RepairPart> parts = repairPartRepository.findByRepairJobIdOrderByCreatedAtAsc(job.getId());
        if (parts.isEmpty()) {
            return;
        }

        UUID mainWarehouseId = warehouseService.getDefaultWarehouseId();
        BigDecimal cogsTotal = BigDecimal.ZERO;
        for (RepairPart part : parts) {
            Product product = productRepository.findByIdAndDeletedFalse(part.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + part.getProductId()));
            int quantity = part.getQuantity();

            product.setStockQuantity(product.getStockQuantity() + quantity);
            productRepository.save(product);
            warehouseStockService.applyDelta(mainWarehouseId, product, quantity);
            productService.evictProductCache(product.getId());
            stockMovementService.recordMovement(product, mainWarehouseId, StockMovement.MovementType.REPAIR_PART_CONSUMED,
                    quantity, job.getJobNumber(), "Reversed on cancellation");

            cogsTotal = cogsTotal.add(part.getUnitCost().multiply(BigDecimal.valueOf(quantity)));
        }

        postPartsCogsJournalEntry(job, cogsTotal, true);
    }

    private void postPartsCogsJournalEntry(RepairJob job, BigDecimal amount, boolean reversed) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        try {
            Optional<Account> cogs = accountRepository.findByCodeAndDeletedFalse(COGS_ACCOUNT_CODE);
            Optional<Account> inventory = accountRepository.findByCodeAndDeletedFalse(INVENTORY_ACCOUNT_CODE);
            if (cogs.isEmpty() || inventory.isEmpty()) {
                log.warn("Skipping parts COGS auto-journal for repair job {}: missing well-known account(s) {}/{}",
                        job.getJobNumber(), COGS_ACCOUNT_CODE, INVENTORY_ACCOUNT_CODE);
                return;
            }

            JournalEntryLineDTO debit;
            JournalEntryLineDTO credit;
            if (!reversed) {
                debit = debitLine(cogs.get().getId(), amount, "COGS - Repair Job " + job.getJobNumber());
                credit = creditLine(inventory.get().getId(), amount, "Inventory - Repair Job " + job.getJobNumber());
            } else {
                debit = debitLine(inventory.get().getId(), amount, "Inventory (reversal) - Repair Job " + job.getJobNumber());
                credit = creditLine(cogs.get().getId(), amount, "COGS (reversal) - Repair Job " + job.getJobNumber());
            }

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Repair Job " + job.getJobNumber() + (reversed ? " (parts reversal)" : " (parts COGS)"));
            entry.setReference(job.getJobNumber());
            entry.setLines(List.of(debit, credit));

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create parts COGS auto-journal entry for repair job {}: {}", job.getJobNumber(), e.getMessage());
        }
    }

    // ============================================================================================
    // Repair payments
    // ============================================================================================

    @Transactional
    public RepairJobDto addPayment(UUID repairId, CreateRepairPaymentRequest request) {
        RepairJob job = getEntity(repairId);

        RepairPayment.AmountType amountType;
        try {
            amountType = RepairPayment.AmountType.valueOf(request.getAmountType().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown amountType: " + request.getAmountType());
        }

        String paymentMethod = request.getPaymentMethod() == null ? "" : request.getPaymentMethod().trim().toUpperCase();
        if (!ALLOWED_PAYMENT_METHODS.contains(paymentMethod)) {
            throw new IllegalArgumentException("paymentMethod must be one of " + ALLOWED_PAYMENT_METHODS);
        }

        RepairPayment payment = new RepairPayment();
        payment.setRepairJobId(job.getId());
        payment.setAmountType(amountType);
        payment.setAmount(request.getAmount());
        payment.setPaymentMethod(paymentMethod);
        payment.setPaidAt(LocalDateTime.now());
        repairPaymentRepository.save(payment);

        if (amountType == RepairPayment.AmountType.DEPOSIT) {
            postDepositJournalEntry(job, payment);
        }

        return toDtoWithDetails(job);
    }

    /** WP (cash-leg split): a deposit is recognized immediately as a liability (not yet revenue) -
     * Dr <account resolved from payment.getPaymentMethod() via CashAccountResolver: CASH -> 1111,
     * CARD -> 1112, EWALLET -> 1113, STORE_CREDIT -> 2140> / Cr Customer Deposits (2150).
     * Previously CARD/EWALLET deposits were incorrectly lumped into the same "Cash" 1110 leg as
     * CASH ones - resolving through the single CashAccountResolver mapping instead of a two-way
     * ternary fixes that as a side effect. */
    private void postDepositJournalEntry(RepairJob job, RepairPayment payment) {
        try {
            String debitAccountCode = cashAccountResolver.resolveCode(payment.getPaymentMethod());

            Optional<Account> debitAccount = accountRepository.findByCodeAndDeletedFalse(debitAccountCode);
            Optional<Account> customerDeposits = accountRepository.findByCodeAndDeletedFalse(CUSTOMER_DEPOSITS_ACCOUNT_CODE);
            if (debitAccount.isEmpty() || customerDeposits.isEmpty()) {
                log.warn("Skipping deposit auto-journal for repair job {}: missing well-known account(s) {}/{}",
                        job.getJobNumber(), debitAccountCode, CUSTOMER_DEPOSITS_ACCOUNT_CODE);
                return;
            }

            JournalEntryLineDTO debit = debitLine(debitAccount.get().getId(), payment.getAmount(),
                    debitAccount.get().getName() + " - Repair Deposit " + job.getJobNumber());
            JournalEntryLineDTO credit = creditLine(customerDeposits.get().getId(), payment.getAmount(),
                    "Customer Deposits - Repair Job " + job.getJobNumber());

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Repair Deposit " + job.getJobNumber());
            entry.setReference(job.getJobNumber());
            entry.setLines(List.of(debit, credit));

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create deposit auto-journal entry for repair job {}: {}", job.getJobNumber(), e.getMessage());
        }
    }

    // ============================================================================================
    // Repair payment refunds (V37)
    // ============================================================================================

    /**
     * Refunds part or all of a specific payment previously recorded against this job. The refund
     * is always a brand-new {@link RepairPayment} row (isRefund=true) linked back to
     * {@code paymentId} via {@code originalPaymentId} - the original row is never edited (same
     * append-only contract as every other write in this table).
     *
     * <h2>Amount guard</h2>
     * The requested amount must be positive (bean validation, 400) and must not exceed the job's
     * net paid (collections minus refunds already made, {@link #computeNetPaid}) - refusing (400)
     * otherwise. This is a job-level cap, not a per-original-payment cap: a refund may exceed the
     * specific original payment's own amount as long as the job overall still has that much net
     * paid (e.g. refunding 150 against a 50 deposit is fine if a 110 balance payment brought net
     * paid to 160).
     *
     * <h2>Method / destination</h2>
     * Defaults to the original payment's own method (refund goes back the way it came in);
     * {@code request.method} may explicitly override it to any of CASH/CARD/EWALLET/STORE_CREDIT.
     * STORE_CREDIT requires the job's customer to resolve to a registered loyalty {@code Member}
     * (see {@link #resolveMemberForStoreCreditRefund}) - otherwise 400. When it does, the member's
     * store-credit balance is credited (blocking - inside this same transaction, via
     * {@code MemberService#creditStoreCredit}, so a failure there rolls back the whole refund
     * rather than leaving a refund row with no matching credit).
     *
     * <h2>Journal (auto-posted, non-blocking - same convention as every other repair auto-journal
     * hook in this class)</h2>
     * The case is derived strictly from the job's current status, never from the original
     * payment's amount_type - this is not a guess, it directly reads whether the COLLECTED
     * transition (and therefore {@link #createCollectionJournalEntry}) has already run for this
     * job:
     * <ul>
     *   <li>Job status != COLLECTED: nothing has been recognized as revenue yet - any money taken
     *   so far (deposit or an early balance/full payment) is still sitting as the Customer
     *   Deposits liability's counterpart in substance, so the refund clears that liability:
     *   Dr 2150 Customer Deposits / Cr &lt;resolved refund-method account&gt;.</li>
     *   <li>Job status == COLLECTED: {@link #createCollectionJournalEntry} has already recognized
     *   the full totalCost as Service Revenue, so a refund now must reverse that recognition
     *   instead: Dr 4200 Service Revenue / Cr &lt;resolved refund-method account&gt;.</li>
     * </ul>
     * The credit leg's account is resolved via {@link CashAccountResolver} exactly like every
     * incoming payment (CASH-&gt;1111, CARD-&gt;1112, EWALLET-&gt;1113, STORE_CREDIT-&gt;2140) - never
     * hardcoded.
     *
     * <h2>Collected-underpaid guard</h2>
     * If the job is COLLECTED and this refund would leave net paid below totalCost, the refund is
     * blocked (409) unless {@code request.override} is explicitly true. DECISION: a
     * collected-but-now-underpaid job is a data-integrity smell (the customer walked away with
     * goods paid in full, and is now being handed money back below what they paid) - it should
     * never happen silently, but the real-world "goodwill refund on a disputed repair" case
     * described in the task genuinely needs to allow it, hence the explicit opt-in rather than an
     * outright block.
     */
    @Transactional
    public RepairJobDto refundPayment(UUID repairId, UUID paymentId, RefundRepairPaymentRequest request) {
        RepairJob job = getEntity(repairId);

        RepairPayment original = repairPaymentRepository.findById(paymentId)
                .filter(p -> p.getRepairJobId().equals(job.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Repair payment not found: " + paymentId));
        if (Boolean.TRUE.equals(original.getIsRefund())) {
            throw new IllegalArgumentException("Cannot refund a refund record (payment " + paymentId + ")");
        }

        BigDecimal amount = request.getAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Refund amount must be positive");
        }

        BigDecimal netPaid = computeNetPaid(job.getId());
        if (amount.compareTo(netPaid) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Refund amount (%s) exceeds the net amount paid on repair job %s (%s)",
                    amount, job.getJobNumber(), netPaid));
        }

        String method = (request.getMethod() == null || request.getMethod().isBlank())
                ? original.getPaymentMethod()
                : request.getMethod().trim().toUpperCase();
        if (!ALLOWED_PAYMENT_METHODS.contains(method)) {
            throw new IllegalArgumentException("method must be one of " + ALLOWED_PAYMENT_METHODS);
        }

        boolean jobCollected = job.getStatus() == RepairJob.RepairStatus.COLLECTED;
        if (jobCollected) {
            BigDecimal totalCost = job.getTotalCost() != null ? job.getTotalCost() : BigDecimal.ZERO;
            BigDecimal netPaidAfter = netPaid.subtract(amount);
            if (netPaidAfter.compareTo(totalCost) < 0 && !request.isOverride()) {
                throw new IllegalStateException(String.format(
                        "Refunding %s from collected repair job %s would leave it underpaid (net paid %s would fall "
                                + "below total cost %s) - pass override=true to confirm this is intentional "
                                + "(e.g. a goodwill refund)",
                        amount, job.getJobNumber(), netPaidAfter, totalCost));
            }
        }

        Member member = null;
        if ("STORE_CREDIT".equals(method)) {
            member = resolveMemberForStoreCreditRefund(job);
        }

        String actingUser = currentUsername();

        RepairPayment refund = new RepairPayment();
        refund.setRepairJobId(job.getId());
        refund.setAmountType(original.getAmountType());
        refund.setAmount(amount);
        refund.setPaymentMethod(method);
        refund.setPaidAt(LocalDateTime.now());
        refund.setIsRefund(true);
        refund.setOriginalPaymentId(original.getId());
        refund.setRefundReason(request.getReason());
        refund.setRefundedBy(actingUser);
        repairPaymentRepository.save(refund);

        if (member != null) {
            memberService.creditStoreCredit(member.getId(), amount);
        }

        postRefundJournalEntry(job, refund, jobCollected);

        return toDtoWithDetails(job);
    }

    /**
     * V37: resolves "is this repair job's customer a registered loyalty member" for a
     * STORE_CREDIT refund. RepairJob only carries {@code customerId} (a {@code Customer}) - there
     * is no direct FK from Customer to Member anywhere in the schema (PosSale/PosTradeIn carry
     * their own independent memberId instead) - so this matches on phone number, which is unique
     * on both sides for a real person. Throws (400) with a caller-facing message when the job has
     * no linked customer, the customer record is missing, or no member shares that phone number.
     */
    private Member resolveMemberForStoreCreditRefund(RepairJob job) {
        if (job.getCustomerId() == null) {
            throw new IllegalArgumentException(
                    "Cannot refund to store credit: repair job " + job.getJobNumber()
                            + " has no registered customer (walk-in jobs are not members)");
        }
        Customer customer = customerRepository.findByIdAndDeletedFalse(job.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found: " + job.getCustomerId()));
        if (customer.getPhone() == null || customer.getPhone().isBlank()) {
            throw new IllegalArgumentException(
                    "Cannot refund to store credit: customer " + customer.getName() + " has no phone number on "
                            + "file to match against a member account");
        }
        return memberRepository.findByPhoneAndDeletedFalse(customer.getPhone())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Cannot refund to store credit: customer " + customer.getName() + " (" + customer.getPhone()
                                + ") is not a registered loyalty member"));
    }

    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            return "system";
        }
        return authentication.getName();
    }

    /** See {@link #refundPayment} javadoc for the full derivation of which case applies and why.
     * Non-blocking, same convention as every other repair auto-journal hook in this class. */
    private void postRefundJournalEntry(RepairJob job, RepairPayment refund, boolean jobCollected) {
        try {
            String creditAccountCode = cashAccountResolver.resolveCode(refund.getPaymentMethod());
            String debitAccountCode = jobCollected ? SERVICE_REVENUE_ACCOUNT_CODE : CUSTOMER_DEPOSITS_ACCOUNT_CODE;

            Optional<Account> debitAccount = accountRepository.findByCodeAndDeletedFalse(debitAccountCode);
            Optional<Account> creditAccount = accountRepository.findByCodeAndDeletedFalse(creditAccountCode);
            if (debitAccount.isEmpty() || creditAccount.isEmpty()) {
                log.warn("Skipping refund auto-journal for repair job {}: missing well-known account(s) {}/{}",
                        job.getJobNumber(), debitAccountCode, creditAccountCode);
                return;
            }

            String descriptionSuffix = jobCollected ? " (revenue reversal)" : " (deposit liability cleared)";
            JournalEntryLineDTO debit = debitLine(debitAccount.get().getId(), refund.getAmount(),
                    debitAccount.get().getName() + " - Repair Refund " + job.getJobNumber() + descriptionSuffix);
            JournalEntryLineDTO credit = creditLine(creditAccount.get().getId(), refund.getAmount(),
                    creditAccount.get().getName() + " - Repair Refund " + job.getJobNumber());

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Repair Refund " + job.getJobNumber() + descriptionSuffix);
            entry.setReference(job.getJobNumber());
            entry.setLines(List.of(debit, credit));

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create refund auto-journal entry for repair job {}: {}", job.getJobNumber(), e.getMessage());
        }
    }

    private void guardFullyPaidUnlessWarrantyClaim(RepairJob job) {
        if (Boolean.TRUE.equals(job.getIsWarrantyClaim())) {
            return;
        }
        BigDecimal netPaid = computeNetPaid(job.getId());
        BigDecimal totalCost = job.getTotalCost() != null ? job.getTotalCost() : BigDecimal.ZERO;
        if (netPaid.compareTo(totalCost) < 0) {
            throw new IllegalStateException(String.format(
                    "Cannot collect repair job %s: net payments recorded (%s) are less than the total cost (%s)",
                    job.getJobNumber(), netPaid, totalCost));
        }
    }

    /** V37: gross collections only (non-refund rows) - see #computeNetPaid for the figure that
     * actually nets refunds out. */
    private BigDecimal sumPayments(UUID jobId) {
        return repairPaymentRepository.findByRepairJobIdOrderByPaidAtAsc(jobId).stream()
                .filter(p -> !Boolean.TRUE.equals(p.getIsRefund()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** V37: sum of refund rows for a job. */
    private BigDecimal sumRefunds(UUID jobId) {
        return repairPaymentRepository.findByRepairJobIdOrderByPaidAtAsc(jobId).stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsRefund()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** V37: "collections minus refunds" - the model-choice's headline figure (see
     * V37__repair_payment_refunds.sql), and what every refund/collection guard actually compares
     * against totalCost. */
    private BigDecimal computeNetPaid(UUID jobId) {
        return sumPayments(jobId).subtract(sumRefunds(jobId));
    }

    /**
     * Non-blocking, mirroring PosSaleService's auto-journal hooks: at COLLECTED, recognizes the
     * deposit liability + any balance/full payment as Service Revenue (4200) - Dr <one line per
     * payment method actually used for a balance/full payment, resolved via CashAccountResolver:
     * CASH -> 1111, CARD -> 1112, EWALLET -> 1113, STORE_CREDIT -> 2140> + Dr Customer Deposits
     * (clearing the deposit liability) / Cr Service Revenue (totalCost).
     *
     * <p>WP (cash-leg split): previously CASH/CARD/EWALLET balance payments were all lumped into
     * one "Cash" 1110 debit regardless of how the customer actually paid - each method now gets
     * its own resolved account/line instead. Amounts are clamped in {@link #COLLECTION_METHOD_ORDER}
     * order so the entry balances exactly to totalCost even if payments recorded exceed it
     * (guardFullyPaidUnlessWarrantyClaim already ensures they cover at least totalCost). Never
     * posted for a warranty claim (totalCost is always 0 there).
     */
    private void createCollectionJournalEntry(RepairJob job) {
        if (Boolean.TRUE.equals(job.getIsWarrantyClaim())) {
            return;
        }
        BigDecimal totalCost = job.getTotalCost();
        if (totalCost == null || totalCost.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        try {
            // V37: exclude refund rows from this aggregation - a refund is never itself money
            // collected towards totalCost, and (per #refundPayment) a pre-COLLECTED refund already
            // cleared its own liability entry independently of this one.
            List<RepairPayment> payments = repairPaymentRepository.findByRepairJobIdOrderByPaidAtAsc(job.getId()).stream()
                    .filter(p -> !Boolean.TRUE.equals(p.getIsRefund()))
                    .collect(Collectors.toList());
            BigDecimal depositTotal = sumByType(payments, RepairPayment.AmountType.DEPOSIT);

            BigDecimal remaining = totalCost;
            BigDecimal depositApplied = depositTotal.min(remaining);
            remaining = remaining.subtract(depositApplied);

            Map<String, BigDecimal> appliedByMethod = new LinkedHashMap<>();
            for (String method : COLLECTION_METHOD_ORDER) {
                BigDecimal methodTotal = sumByTypeAndMethods(payments,
                        Set.of(RepairPayment.AmountType.BALANCE, RepairPayment.AmountType.FULL), Set.of(method));
                BigDecimal applied = methodTotal.min(remaining);
                if (applied.compareTo(BigDecimal.ZERO) > 0) {
                    appliedByMethod.put(method, applied);
                    remaining = remaining.subtract(applied);
                }
            }

            Optional<Account> serviceRevenue = accountRepository.findByCodeAndDeletedFalse(SERVICE_REVENUE_ACCOUNT_CODE);
            Optional<Account> customerDeposits = depositApplied.compareTo(BigDecimal.ZERO) > 0
                    ? accountRepository.findByCodeAndDeletedFalse(CUSTOMER_DEPOSITS_ACCOUNT_CODE) : Optional.empty();

            Map<String, Account> methodAccounts = new LinkedHashMap<>();
            boolean missingMethodAccount = false;
            for (String method : appliedByMethod.keySet()) {
                String code = cashAccountResolver.resolveCode(method);
                Optional<Account> account = accountRepository.findByCodeAndDeletedFalse(code);
                if (account.isEmpty()) {
                    missingMethodAccount = true;
                    break;
                }
                methodAccounts.put(method, account.get());
            }

            if (serviceRevenue.isEmpty() || missingMethodAccount
                    || (depositApplied.compareTo(BigDecimal.ZERO) > 0 && customerDeposits.isEmpty())) {
                log.warn("Skipping collection auto-journal for repair job {}: missing well-known account(s)", job.getJobNumber());
                return;
            }

            List<JournalEntryLineDTO> lines = new ArrayList<>();
            for (Map.Entry<String, BigDecimal> methodApplied : appliedByMethod.entrySet()) {
                Account account = methodAccounts.get(methodApplied.getKey());
                lines.add(debitLine(account.getId(), methodApplied.getValue(),
                        account.getName() + " - Repair Job " + job.getJobNumber()));
            }
            if (depositApplied.compareTo(BigDecimal.ZERO) > 0) {
                lines.add(debitLine(customerDeposits.get().getId(), depositApplied, "Deposit recognized - Repair Job " + job.getJobNumber()));
            }
            lines.add(creditLine(serviceRevenue.get().getId(), totalCost, "Service Revenue - Repair Job " + job.getJobNumber()));

            JournalEntryDTO entry = new JournalEntryDTO();
            entry.setEntryDate(LocalDate.now());
            entry.setDescription("Auto-generated: Repair Job " + job.getJobNumber());
            entry.setReference(job.getJobNumber());
            entry.setLines(lines);

            nonBlockingHookExecutor.runInNewTransaction(() -> accountingService.createSystemEntry(entry));
        } catch (Exception e) {
            log.warn("Failed to create collection auto-journal entry for repair job {}: {}", job.getJobNumber(), e.getMessage());
        }
    }

    private BigDecimal sumByType(List<RepairPayment> payments, RepairPayment.AmountType type) {
        return payments.stream()
                .filter(p -> p.getAmountType() == type)
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumByTypeAndMethods(List<RepairPayment> payments, Set<RepairPayment.AmountType> types, Set<String> methods) {
        return payments.stream()
                .filter(p -> types.contains(p.getAmountType()) && methods.contains(p.getPaymentMethod()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * WP: non-blocking auto-issue of a workmanship warranty at COLLECTED, gated on
     * {@code mulaerp.repair.warranty-months} (default 1; 0 or unset disables it). WarrantyService
     * is resolved lazily via ObjectProvider to break the constructor cycle described in this
     * class's Javadoc. Skips (logs, never fails the transition) when the job has no linked catalog
     * product - Warranty#productId is NOT NULL and a walk-in repair may not reference one.
     */
    private void issueWorkmanshipWarranty(RepairJob job) {
        if (repairWarrantyMonths <= 0) {
            return;
        }
        try {
            nonBlockingHookExecutor.runInNewTransaction(
                    () -> warrantyServiceProvider.getObject().issueWorkmanshipWarranty(job, repairWarrantyMonths));
        } catch (Exception e) {
            log.warn("Failed to auto-issue workmanship warranty for repair job {}: {}", job.getJobNumber(), e.getMessage());
        }
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

    /** partsCost is the sum of repair_parts when any exist for this job, else the manual field -
     * per the approved design decision (recomputed on every add/remove/update). */
    private void recomputeTotalCost(RepairJob job) {
        if (Boolean.TRUE.equals(job.getIsWarrantyClaim())) {
            job.setTotalCost(BigDecimal.ZERO);
            return;
        }

        List<RepairPart> parts = job.getId() != null
                ? repairPartRepository.findByRepairJobIdOrderByCreatedAtAsc(job.getId()) : List.of();
        BigDecimal partsCostTotal;
        if (!parts.isEmpty()) {
            partsCostTotal = parts.stream()
                    .map(p -> p.getUnitCost().multiply(BigDecimal.valueOf(p.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        } else {
            partsCostTotal = job.getPartsCost() != null ? job.getPartsCost() : BigDecimal.ZERO;
        }
        BigDecimal labour = job.getLabourCost() != null ? job.getLabourCost() : BigDecimal.ZERO;
        job.setTotalCost(partsCostTotal.add(labour));
    }

    private RepairJob.RepairStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return RepairJob.RepairStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown repair status: " + status);
        }
    }

    private Specification<RepairJob> buildSpecification(RepairJob.RepairStatus status, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("jobNumber")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("deviceDescription"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("walkInName"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("serialNumber"), "")), like)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private RepairJob getEntity(UUID id) {
        return repairJobRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Repair job not found: " + id));
    }

    private RepairJobDto toDtoWithDetails(RepairJob job) {
        RepairJobDto dto = RepairJobDto.fromEntity(job);
        List<RepairPart> parts = repairPartRepository.findByRepairJobIdOrderByCreatedAtAsc(job.getId());
        List<RepairPayment> payments = repairPaymentRepository.findByRepairJobIdOrderByPaidAtAsc(job.getId());
        dto.setParts(parts.stream().map(RepairPartDto::fromEntity).collect(Collectors.toList()));
        dto.setPayments(payments.stream().map(RepairPaymentDto::fromEntity).collect(Collectors.toList()));

        BigDecimal totalPaid = payments.stream()
                .filter(p -> !Boolean.TRUE.equals(p.getIsRefund()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalRefunded = payments.stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsRefund()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalPaid(totalPaid);
        dto.setTotalRefunded(totalRefunded);
        dto.setNetPaid(totalPaid.subtract(totalRefunded));

        warrantyRepository.findByRepairJobIdAndDeletedFalse(job.getId()).ifPresent(w -> dto.setIssuedWarrantyId(w.getId()));
        return dto;
    }

    // count()-based sequence has no locking, so two concurrent repair job creations can read the
    // same count and produce the same number - append a random hex suffix so the number is unique
    // by construction even when that race happens (same pattern as PurchaseOrderService/PosSaleService).
    private String generateJobNumber() {
        String prefix = "RJ-" + LocalDate.now().getYear() + "-";
        long count = repairJobRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }
}
