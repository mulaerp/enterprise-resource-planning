package com.mulaerp.warranty.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.product.entity.Product;
import com.mulaerp.repair.dto.RepairJobDto;
import com.mulaerp.repair.entity.RepairJob;
import com.mulaerp.repair.service.RepairJobService;
import com.mulaerp.settings.service.SettingsService;
import com.mulaerp.warranty.dto.ClaimWarrantyRequest;
import com.mulaerp.warranty.dto.CreateWarrantyRequest;
import com.mulaerp.warranty.dto.WarrantyDto;
import com.mulaerp.warranty.entity.Warranty;
import com.mulaerp.warranty.repository.WarrantyRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * In-house warranties, both manually issued by staff and auto-issued from PoS sales / delivered
 * sales-order serials (see PosSaleService/SalesOrderService, which call
 * #autoIssueForPosSaleLine / #autoIssueForSalesOrderSerial from inside their own non-blocking
 * try/catch hooks - kept there rather than here so a warranty-issue failure is logged against the
 * originating sale/order, same as the existing email/journal hooks).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WarrantyService {

    /** DATA INTEGRITY: cap on auto-issued warranties per PoS sale line - see #autoIssueForPosSaleLine. */
    private static final int MAX_WARRANTIES_PER_LINE = 20;

    private final WarrantyRepository warrantyRepository;
    private final RepairJobService repairJobService;
    private final SettingsService settingsService;

    @Transactional(readOnly = true)
    public Page<WarrantyDto> getAllWarranties(String status, String search, Pageable pageable) {
        Warranty.WarrantyStatus statusFilter = parseStatus(status);
        Specification<Warranty> spec = buildSpecification(statusFilter, search);
        return warrantyRepository.findAll(spec, pageable).map(WarrantyDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public WarrantyDto getWarrantyById(UUID id) {
        return WarrantyDto.fromEntity(getEntity(id));
    }

    @Transactional
    public WarrantyDto createWarranty(CreateWarrantyRequest request) {
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();

        Warranty warranty = new Warranty();
        warranty.setWarrantyNumber(generateWarrantyNumber());
        warranty.setProductId(request.getProductId());
        warranty.setProductName(request.getProductId() != null ? productNameOrFallback(request) : "Unknown product");
        warranty.setSerialId(request.getSerialId());
        warranty.setBatchId(request.getBatchId());
        warranty.setPosSaleId(request.getPosSaleId());
        warranty.setSalesOrderId(request.getSalesOrderId());
        warranty.setCustomerId(request.getCustomerId());
        warranty.setMemberId(request.getMemberId());
        warranty.setStartDate(startDate);
        warranty.setMonths(request.getMonths());
        warranty.setExpiryDate(startDate.plusMonths(request.getMonths()));
        warranty.setStatus(Warranty.WarrantyStatus.ACTIVE);
        warranty.setTerms(request.getTerms());

        return WarrantyDto.fromEntity(warrantyRepository.save(warranty));
    }

    @Transactional
    public WarrantyDto voidWarranty(UUID id) {
        Warranty warranty = getEntity(id);
        warranty.setStatus(Warranty.WarrantyStatus.VOID);
        return WarrantyDto.fromEntity(warrantyRepository.save(warranty));
    }

    /**
     * Sets the warranty CLAIMED and creates a linked, no-charge RepairJob
     * (RepairJobService#createForWarrantyClaim) - contract: "returns the repair job".
     */
    @Transactional
    public RepairJobDto claimWarranty(UUID id, ClaimWarrantyRequest request) {
        Warranty warranty = getEntity(id);
        if (warranty.getStatus() != Warranty.WarrantyStatus.ACTIVE) {
            throw new IllegalStateException("Only an ACTIVE warranty can be claimed (current status: " + warranty.getStatus() + ")");
        }

        warranty.setStatus(Warranty.WarrantyStatus.CLAIMED);
        Warranty saved = warrantyRepository.save(warranty);

        return repairJobService.createForWarrantyClaim(saved, request.getReportedFault());
    }

    /**
     * DATA INTEGRITY fix (post-overhaul audit): one warranty per UNIT sold on a PoS sale line -
     * previously this issued exactly one warranty per line regardless of quantity, so e.g. a
     * 2-unit sale of a warrantied product could only ever have one warranty claimed against it.
     * Capped at {@link #MAX_WARRANTIES_PER_LINE} units per line (with a warn log beyond that) so
     * an unusually large line quantity can't spam the warranty table. Call site (PosSaleService)
     * wraps this in its own try/catch (via NonBlockingHookExecutor's own transaction) so a failure
     * here never fails the sale.
     *
     * <p><b>WARRANTY-TIERS (V44) DELIBERATE BEHAVIOUR CHANGE:</b> this used to return with no
     * warranty issued at all when {@code product.warrantyMonths} was null/&lt;=0. It no longer
     * does - see {@link #resolveDuration} (the shared floor-rule helper also used by {@link
     * #autoIssueForShopOrderLine}): every unit sold now gets AT LEAST the channel's guest/member
     * base-days warranty, with a longer product warranty always taking priority (a floor, never a
     * shortening). {@code memberId != null} is exactly PosSaleService's own definition of "a
     * member was attached to this sale" - reused here unchanged rather than re-derived.
     */
    @Transactional
    public void autoIssueForPosSaleLine(Product product, int quantity, UUID posSaleId, UUID memberId) {
        int unitsToIssue = Math.min(quantity, MAX_WARRANTIES_PER_LINE);
        if (quantity > MAX_WARRANTIES_PER_LINE) {
            log.warn("PoS sale {} line for product {} sold {} units - capping auto-issued warranties at {}",
                    posSaleId, product.getSku(), quantity, MAX_WARRANTIES_PER_LINE);
        }

        boolean isMember = memberId != null;
        ResolvedDuration duration = resolveDuration(LocalDate.now(), product.getWarrantyMonths(), isMember);

        for (int i = 0; i < unitsToIssue; i++) {
            Warranty warranty = new Warranty();
            warranty.setWarrantyNumber(generateWarrantyNumber());
            warranty.setProductId(product.getId());
            warranty.setProductName(product.getName());
            warranty.setPosSaleId(posSaleId);
            warranty.setMemberId(memberId);
            warranty.setStartDate(duration.startDate());
            warranty.setMonths(duration.months());
            warranty.setDurationDays(duration.durationDays());
            warranty.setDurationSource(duration.source());
            warranty.setExpiryDate(duration.expiryDate());
            warranty.setStatus(Warranty.WarrantyStatus.ACTIVE);

            warrantyRepository.save(warranty);
        }
    }

    /**
     * V42 (WEBSHOP Gap B): one warranty per UNIT fulfilled on a web order line whose product has
     * warrantyMonths set - mirrors {@link #autoIssueForPosSaleLine} exactly (same
     * {@link #MAX_WARRANTIES_PER_LINE} cap, same per-unit loop), reusing this one method rather
     * than duplicating warranty-issue logic for the storefront. Call site
     * (ShopOrderService#fulfilOrder) wraps each call through NonBlockingHookExecutor (its own
     * try/catch, REQUIRES_NEW transaction) so a failure here never fails the fulfilment - identical
     * non-blocking-hook pattern to the PoS call site.
     *
     * <p>Attribution (at most one of memberId/shopCustomerId is ever non-null, mirroring the
     * mutually-exclusive shape ShopOrder itself uses for shopCustomerId vs guest* fields):
     * <ul>
     *   <li>{@code memberId} set - the buyer's ShopCustomer is linked to a loyalty Member; matches
     *   how a PoS sale attributes its warranties.</li>
     *   <li>{@code shopCustomerId} set (memberId null) - a signed-in shop customer with no loyalty
     *   link; there is no bridge from ShopCustomer to the back-office Customer entity today, so
     *   this dedicated column is used rather than overloading {@code customerId} (see V42's
     *   javadoc on the Warranty entity).</li>
     *   <li>Both null - a GUEST order. {@code shopOrderId} is the only attribution: the guest's
     *   contact details live on that order (guestEmail/guestName/guestPhone), findable the same
     *   way {@code ShopOrderService#guestLookup} already works (order number + the email the guest
     *   themselves supplied) - and the warranty is independently findable at any time via the
     *   existing anonymous {@code GET /api/v1/public/warranty/{code}} lookup by warranty number,
     *   which never required a customer identity in the first place.</li>
     * </ul>
     */
    @Transactional
    public void autoIssueForShopOrderLine(Product product, int quantity, UUID shopOrderId, UUID memberId, UUID shopCustomerId) {
        int unitsToIssue = Math.min(quantity, MAX_WARRANTIES_PER_LINE);
        if (quantity > MAX_WARRANTIES_PER_LINE) {
            log.warn("Web order {} line for product {} sold {} units - capping auto-issued warranties at {}",
                    shopOrderId, product.getSku(), quantity, MAX_WARRANTIES_PER_LINE);
        }

        // OWNER DECISION: membership (a loyalty Member link), not merely being signed in, decides
        // guest vs member base days - a signed-in ShopCustomer with no loyalty link (memberId
        // null, shopCustomerId set) is still a GUEST for warranty-tier purposes, same as PoS.
        boolean isMember = memberId != null;
        ResolvedDuration duration = resolveDuration(LocalDate.now(), product.getWarrantyMonths(), isMember);

        for (int i = 0; i < unitsToIssue; i++) {
            Warranty warranty = new Warranty();
            warranty.setWarrantyNumber(generateWarrantyNumber());
            warranty.setProductId(product.getId());
            warranty.setProductName(product.getName());
            warranty.setShopOrderId(shopOrderId);
            warranty.setMemberId(memberId);
            warranty.setShopCustomerId(shopCustomerId);
            warranty.setStartDate(duration.startDate());
            warranty.setMonths(duration.months());
            warranty.setDurationDays(duration.durationDays());
            warranty.setDurationSource(duration.source());
            warranty.setExpiryDate(duration.expiryDate());
            warranty.setStatus(Warranty.WarrantyStatus.ACTIVE);

            warrantyRepository.save(warranty);
        }
    }

    /**
     * WARRANTY-TIERS (V44): the ONE shared floor-rule helper - both {@link
     * #autoIssueForPosSaleLine} and {@link #autoIssueForShopOrderLine} call this exact method
     * rather than each computing their own max() logic, so in-store and online warranty issuance
     * can never drift apart.
     *
     * <p>OWNER DECISION, the single most important correctness rule here: the channel base-days
     * warranty is a FLOOR, never a replacement. Effective cover =
     * {@code MAX(productExpiry, channelExpiry)} where {@code productExpiry} is
     * {@code startDate.plusMonths(productWarrantyMonths)} (or absent entirely when the product has
     * no warrantyMonths set) and {@code channelExpiry} is {@code startDate.plusDays(baseDays)},
     * {@code baseDays} resolved from {@link SettingsService#getMemberBaseDays()} /
     * {@link SettingsService#getGuestBaseDays()} depending on {@code isMember}. A product's
     * warranty is NEVER shortened by this feature - a 6-month product warranty stays 6 months
     * whether or not a member is attached. On a tie, PRODUCT_MONTHS wins (it is the real,
     * merchant-set warranty term, not a generic channel default).
     *
     * <p>DELIBERATE BEHAVIOUR CHANGE: a product with no warrantyMonths at all (previously: no
     * warranty issued, ever) now always yields a warranty - the channel base-days floor applies
     * unconditionally, since there is no product-months figure to compare against.
     */
    private ResolvedDuration resolveDuration(LocalDate startDate, Integer productWarrantyMonths, boolean isMember) {
        LocalDate productExpiry = (productWarrantyMonths != null && productWarrantyMonths > 0)
                ? startDate.plusMonths(productWarrantyMonths)
                : null;

        int baseDays = isMember ? settingsService.getMemberBaseDays() : settingsService.getGuestBaseDays();
        LocalDate channelExpiry = startDate.plusDays(baseDays);

        if (productExpiry != null && !productExpiry.isBefore(channelExpiry)) {
            return new ResolvedDuration(startDate, productExpiry, productWarrantyMonths, null, Warranty.DurationSource.PRODUCT_MONTHS);
        }

        Warranty.DurationSource source = isMember ? Warranty.DurationSource.MEMBER_BASE : Warranty.DurationSource.GUEST_BASE;
        return new ResolvedDuration(startDate, channelExpiry, null, baseDays, source);
    }

    /** Result of {@link #resolveDuration} - exactly one of {@code months}/{@code durationDays} is
     * non-null, matching {@link Warranty}'s own mutually-exclusive shape for the two fields. */
    private record ResolvedDuration(
            LocalDate startDate,
            LocalDate expiryDate,
            Integer months,
            Integer durationDays,
            Warranty.DurationSource source
    ) {
    }

    /**
     * Auto-issue hook: one warranty per serial fulfilled on a SalesOrder line transitioning into
     * DELIVERED, when the product has warrantyMonths set. Call site (SalesOrderService) wraps
     * this in its own try/catch so a failure here never fails the delivery. Out of scope for the
     * WARRANTY-TIERS (V44) guest/member floor rule - back-office sales-order delivery is not one
     * of the two channels ("Applies UNIFORMLY to online AND in-store sales", i.e. PoS + the web
     * shop) the owner decision names, so this keeps its pre-existing months-only behaviour
     * (duration_source stays the default PRODUCT_MONTHS, duration_days stays null).
     */
    @Transactional
    public void autoIssueForSalesOrderSerial(Product product, UUID serialId, UUID salesOrderId, UUID customerId) {
        if (product.getWarrantyMonths() == null || product.getWarrantyMonths() <= 0) {
            return;
        }

        LocalDate startDate = LocalDate.now();
        Warranty warranty = new Warranty();
        warranty.setWarrantyNumber(generateWarrantyNumber());
        warranty.setProductId(product.getId());
        warranty.setProductName(product.getName());
        warranty.setSerialId(serialId);
        warranty.setSalesOrderId(salesOrderId);
        warranty.setCustomerId(customerId);
        warranty.setStartDate(startDate);
        warranty.setMonths(product.getWarrantyMonths());
        warranty.setExpiryDate(startDate.plusMonths(product.getWarrantyMonths()));
        warranty.setStatus(Warranty.WarrantyStatus.ACTIVE);

        warrantyRepository.save(warranty);
    }

    /**
     * WP: auto-issues a workmanship warranty when a repair job reaches COLLECTED - called from
     * RepairJobService (via an ObjectProvider<WarrantyService>, to break the constructor cycle:
     * this class already depends on RepairJobService for #createForWarrantyClaim). Skips (logs,
     * never throws through to the caller's non-blocking hook wrapper) when the job has no linked
     * catalog product - Warranty#productId is NOT NULL and a walk-in repair may not reference one.
     */
    @Transactional
    public void issueWorkmanshipWarranty(RepairJob job, int months) {
        if (job.getProductId() == null) {
            log.warn("Skipping workmanship warranty for repair job {}: no linked catalog product", job.getJobNumber());
            return;
        }

        LocalDate startDate = LocalDate.now();
        Warranty warranty = new Warranty();
        warranty.setWarrantyNumber(generateWarrantyNumber());
        warranty.setProductId(job.getProductId());
        warranty.setProductName(job.getDeviceDescription());
        warranty.setCustomerId(job.getCustomerId());
        warranty.setRepairJobId(job.getId());
        warranty.setStartDate(startDate);
        warranty.setMonths(months);
        warranty.setExpiryDate(startDate.plusMonths(months));
        warranty.setStatus(Warranty.WarrantyStatus.ACTIVE);
        warranty.setTerms("Workmanship warranty issued on repair collection");

        warrantyRepository.save(warranty);
    }

    private String productNameOrFallback(CreateWarrantyRequest request) {
        // Manual issue doesn't require a live Product lookup (staff supply productId only, e.g.
        // for a product later deleted) - kept minimal per the contract, which only requires
        // productId + a snapshot name; staff can pass terms/notes to capture more context.
        return "Product " + request.getProductId();
    }

    private Warranty.WarrantyStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return Warranty.WarrantyStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown warranty status: " + status);
        }
    }

    private Specification<Warranty> buildSpecification(Warranty.WarrantyStatus status, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("warrantyNumber")), like),
                        cb.like(cb.lower(root.get("productName")), like)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Warranty getEntity(UUID id) {
        return warrantyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warranty not found: " + id));
    }

    // count()-based sequence has no locking, so two concurrent warranty issues can read the same
    // count and produce the same number - append a random hex suffix so the number is unique by
    // construction even when that race happens (same pattern as PurchaseOrderService/PosSaleService).
    private String generateWarrantyNumber() {
        String prefix = "WTY-" + LocalDate.now().getYear() + "-";
        long count = warrantyRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }
}
