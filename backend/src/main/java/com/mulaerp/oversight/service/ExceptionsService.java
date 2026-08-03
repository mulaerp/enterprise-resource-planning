package com.mulaerp.oversight.service;

import com.mulaerp.accounting.entity.JournalEntry;
import com.mulaerp.accounting.repository.JournalEntryRepository;
import com.mulaerp.banking.entity.BankTransaction;
import com.mulaerp.banking.repository.BankTransactionRepository;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.oversight.dto.CashierTotalsDto;
import com.mulaerp.oversight.dto.DeepDiscountSaleDto;
import com.mulaerp.oversight.dto.ExceptionsResponseDto;
import com.mulaerp.oversight.dto.PriceFloorSaleLineDto;
import com.mulaerp.oversight.dto.StaleRepairJobDto;
import com.mulaerp.oversight.dto.VoidedSaleDto;
import com.mulaerp.oversight.repository.OversightPosSaleRepository;
import com.mulaerp.pos.entity.PosSale;
import com.mulaerp.pos.entity.PosSaleLine;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.repair.entity.RepairJob;
import com.mulaerp.repair.repository.RepairJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Deep discounts, near-price-floor sales, unposted drafts, unreconciled bank transactions, stale
 * repair jobs, and per-cashier totals - each section returns the offending document references so
 * the UI can drill straight down. All queries reuse existing module repositories read-only (no
 * other module's file is modified for this endpoint), except the PoS date-range scan which goes
 * through the oversight module's own secondary repository (see OversightPosSaleRepository).
 */
@Service
@RequiredArgsConstructor
public class ExceptionsService {

    private static final Set<RepairJob.RepairStatus> TERMINAL_REPAIR_STATUSES =
            Set.of(RepairJob.RepairStatus.COLLECTED, RepairJob.RepairStatus.CANCELLED);

    private final OversightPosSaleRepository oversightPosSaleRepository;
    private final ProductRepository productRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final BankTransactionRepository bankTransactionRepository;
    private final RepairJobRepository repairJobRepository;
    private final CustomerRepository customerRepository;

    @Value("${mulaerp.oversight.deep-discount-percent:30}")
    private int deepDiscountPercent;

    @Value("${mulaerp.oversight.stale-repair-days:14}")
    private int staleRepairDays;

    /** Same floor-calculation property PosSaleService itself enforces - kept in sync deliberately. */
    @Value("${mulaerp.pos.max-discount-percent:50}")
    private int maxDiscountPercent;

    @Transactional(readOnly = true)
    public ExceptionsResponseDto getExceptions(LocalDate from, LocalDate to) {
        LocalDateTime rangeStart = from.atStartOfDay();
        LocalDateTime rangeEnd = to.atTime(LocalTime.MAX);

        // V34: EXCLUDES voided sales from every section below - a reversed sale is no longer a
        // live discount-abuse/cashier-performance signal (see MoneyFlowService's exclusion for
        // the same reasoning). Voided sales get their own dedicated section instead.
        List<PosSale> sales = oversightPosSaleRepository.findByCreatedAtBetweenAndStatusAndDeletedFalse(rangeStart, rangeEnd, "COMPLETED");

        List<DeepDiscountSaleDto> deepDiscounts = buildDeepDiscounts(sales);
        List<PriceFloorSaleLineDto> nearFloor = buildNearPriceFloorSales(sales);
        List<CashierTotalsDto> cashierTotals = buildCashierTotals(sales);

        List<JournalEntry> drafts = journalEntryRepository.findByStatusAndEntryDateBetweenAndDeletedFalse(
                JournalEntry.JournalEntryStatus.DRAFT, from, to);
        List<String> draftIds = drafts.stream().map(JournalEntry::getEntryNumber).toList();

        List<BankTransaction> unreconciled = bankTransactionRepository.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("reconciled"), false),
                cb.greaterThanOrEqualTo(root.get("txnDate"), from),
                cb.lessThanOrEqualTo(root.get("txnDate"), to)));
        List<String> unreconciledRefs = unreconciled.stream()
                .map(t -> t.getReference() != null ? t.getReference() : t.getId().toString())
                .toList();

        LocalDateTime staleCutoff = LocalDateTime.now().minusDays(staleRepairDays);
        List<RepairJob> staleJobs = repairJobRepository.findAll((root, query, cb) -> cb.and(
                cb.lessThan(root.get("receivedAt"), staleCutoff),
                cb.not(root.get("status").in(TERMINAL_REPAIR_STATUSES))));
        List<StaleRepairJobDto> staleRepairJobs = staleJobs.stream()
                .map(this::toStaleJobDto)
                .sorted(Comparator.comparingLong(StaleRepairJobDto::daysOpen).reversed())
                .toList();

        // V34: voided sales section - by voidedAt (when the void happened), not the original sale
        // date, since a sale made in an earlier period can be voided within this one.
        List<PosSale> voided = oversightPosSaleRepository.findByStatusAndVoidedAtBetween("VOIDED", rangeStart, rangeEnd);
        List<VoidedSaleDto> voidedSales = voided.stream()
                .map(s -> new VoidedSaleDto(s.getId(), s.getSaleNumber(), s.getVoidedAt(), s.getVoidedBy(),
                        s.getVoidReason(), s.getTotal()))
                .sorted(Comparator.comparing(VoidedSaleDto::voidedAt).reversed())
                .toList();

        return new ExceptionsResponseDto(from, to, deepDiscountPercent, deepDiscounts, nearFloor,
                drafts.size(), draftIds, unreconciled.size(), unreconciledRefs,
                staleRepairDays, staleRepairJobs, cashierTotals, voidedSales.size(), voidedSales);
    }

    private List<DeepDiscountSaleDto> buildDeepDiscounts(List<PosSale> sales) {
        List<DeepDiscountSaleDto> result = new ArrayList<>();
        for (PosSale sale : sales) {
            if (sale.getSubtotal() == null || sale.getSubtotal().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            BigDecimal discountPercent = sale.getDiscountTotal()
                    .divide(sale.getSubtotal(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
            if (discountPercent.compareTo(BigDecimal.valueOf(deepDiscountPercent)) > 0) {
                result.add(new DeepDiscountSaleDto(sale.getSaleNumber(), sale.getCreatedAt(), sale.getCreatedBy(),
                        sale.getSubtotal(), sale.getDiscountTotal(), discountPercent.setScale(2, RoundingMode.HALF_UP)));
            }
        }
        return result;
    }

    private List<PriceFloorSaleLineDto> buildNearPriceFloorSales(List<PosSale> sales) {
        List<PriceFloorSaleLineDto> result = new ArrayList<>();
        for (PosSale sale : sales) {
            for (PosSaleLine line : sale.getLines()) {
                BigDecimal floor = priceFloor(line);
                if (floor == null || floor.compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                BigDecimal marginPercent = line.getUnitPrice().subtract(floor)
                        .divide(floor, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100));
                if (marginPercent.compareTo(BigDecimal.valueOf(5)) <= 0) {
                    result.add(new PriceFloorSaleLineDto(sale.getSaleNumber(), sale.getCreatedAt(), sale.getCreatedBy(),
                            productSku(line.getProductId()), line.getProductName(), line.getUnitPrice(), floor,
                            marginPercent.setScale(2, RoundingMode.HALF_UP)));
                }
            }
        }
        return result;
    }

    /** Mirrors PosSaleService#priceFloor, computed off the product's CURRENT cost basis (falling
     * back to the line's own acquisitionCostSnapshot if the product has since been deleted). */
    private BigDecimal priceFloor(PosSaleLine line) {
        return productRepository.findByIdAndDeletedFalse(line.getProductId())
                .map(product -> {
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
                })
                .orElse(line.getAcquisitionCostSnapshot());
    }

    private String productSku(java.util.UUID productId) {
        return productRepository.findById(productId).map(Product::getSku).orElse(null);
    }

    private List<CashierTotalsDto> buildCashierTotals(List<PosSale> sales) {
        Map<String, List<PosSale>> byCashier = new LinkedHashMap<>();
        for (PosSale sale : sales) {
            String cashier = sale.getCreatedBy() != null ? sale.getCreatedBy() : "unknown";
            byCashier.computeIfAbsent(cashier, k -> new ArrayList<>()).add(sale);
        }

        List<CashierTotalsDto> result = new ArrayList<>();
        for (Map.Entry<String, List<PosSale>> entry : byCashier.entrySet()) {
            List<PosSale> cashierSales = entry.getValue();
            BigDecimal gross = cashierSales.stream().map(PosSale::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal discountSum = cashierSales.stream().map(PosSale::getDiscountTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal average = gross.divide(BigDecimal.valueOf(cashierSales.size()), 2, RoundingMode.HALF_UP);
            BigDecimal discountRate = gross.compareTo(BigDecimal.ZERO) > 0
                    ? discountSum.divide(gross, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            result.add(new CashierTotalsDto(entry.getKey(), cashierSales.size(), gross, average, discountRate,
                    cashierSales.stream().map(PosSale::getSaleNumber).toList()));
        }
        result.sort(Comparator.comparing(CashierTotalsDto::gross).reversed());
        return result;
    }

    private StaleRepairJobDto toStaleJobDto(RepairJob job) {
        long daysOpen = Duration.between(job.getReceivedAt(), LocalDateTime.now()).toDays();
        String customer = job.getCustomerId() != null
                ? customerRepository.findByIdAndDeletedFalse(job.getCustomerId()).map(Customer::getName).orElse(job.getCustomerId().toString())
                : job.getWalkInName();
        return new StaleRepairJobDto(job.getJobNumber(), job.getStatus().name(), job.getReceivedAt(), daysOpen, customer);
    }
}
