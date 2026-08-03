package com.mulaerp.oversight.service;

import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.entity.JournalEntry;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.repository.JournalEntryLineRepository;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.oversight.dto.AmountWithDocumentsDto;
import com.mulaerp.oversight.dto.MoneyFlowResponseDto;
import com.mulaerp.oversight.dto.PaymentMethodTakingsDto;
import com.mulaerp.oversight.dto.PostedJournalCrossCheckDto;
import com.mulaerp.oversight.repository.OversightInvoiceRepository;
import com.mulaerp.oversight.repository.OversightJournalEntryRepository;
import com.mulaerp.oversight.repository.OversightPosSaleRepository;
import com.mulaerp.oversight.repository.OversightPosTradeInRepository;
import com.mulaerp.oversight.repository.OversightRepairPaymentRepository;
import com.mulaerp.pos.entity.PosSale;
import com.mulaerp.pos.entity.PosSaleLine;
import com.mulaerp.pos.entity.PosTradeIn;
import com.mulaerp.repair.entity.RepairJob;
import com.mulaerp.repair.entity.RepairPart;
import com.mulaerp.repair.entity.RepairPayment;
import com.mulaerp.repair.repository.RepairJobRepository;
import com.mulaerp.repair.repository.RepairPartRepository;
import com.mulaerp.shop.order.entity.ShopOrder;
import com.mulaerp.shop.order.repository.ShopOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Day-book / money-flow report, sourced entirely from OPERATIONAL tables (PoS sales, repair
 * payments, trade-ins, repair jobs) rather than journal entries: every auto-journal hook in this
 * codebase (PosSaleService/PosTradeInService/RepairJobService) posts a DRAFT entry, auto-posted
 * immediately by default (see the {@code accounting} skill's auto-posting policy) - but a manual
 * DRAFT entry can still diverge from what actually happened at the till. {@link #buildCrossCheck}
 * surfaces that gap explicitly instead of hiding it - see its javadoc and
 * {@link PostedJournalCrossCheckDto} for exactly what is and isn't compared, and why.
 */
@Service
@RequiredArgsConstructor
public class MoneyFlowService {

    private static final String SALES_REVENUE_ACCOUNT_CODE = "4100";
    private static final String SERVICE_REVENUE_ACCOUNT_CODE = "4200";
    private static final Set<String> PAYMENT_METHODS = Set.of("CASH", "CARD", "EWALLET", "STORE_CREDIT");

    private final OversightPosSaleRepository oversightPosSaleRepository;
    private final OversightPosTradeInRepository oversightPosTradeInRepository;
    private final OversightRepairPaymentRepository oversightRepairPaymentRepository;
    private final OversightInvoiceRepository oversightInvoiceRepository;
    private final OversightJournalEntryRepository oversightJournalEntryRepository;
    private final RepairJobRepository repairJobRepository;
    private final RepairPartRepository repairPartRepository;
    private final AccountRepository accountRepository;
    private final JournalEntryLineRepository journalEntryLineRepository;
    private final ShopOrderRepository shopOrderRepository;

    @Transactional(readOnly = true)
    public MoneyFlowResponseDto getMoneyFlow(LocalDate from, LocalDate to) {
        LocalDateTime rangeStart = from.atStartOfDay();
        LocalDateTime rangeEnd = to.atTime(LocalTime.MAX);

        // V34: EXCLUDES voided sales - a void is a reversed sale, so it must never contribute to
        // takings/COGS/margin here (its stock and books were already reversed independently at
        // void time - see PosSaleService#voidSale). Voided sales instead surface in the
        // oversight exceptions "Voided sales" section for visibility.
        List<PosSale> sales = oversightPosSaleRepository.findByCreatedAtBetweenAndStatusAndDeletedFalse(rangeStart, rangeEnd, "COMPLETED");
        List<PosTradeIn> tradeIns = oversightPosTradeInRepository.findByCreatedAtBetweenAndDeletedFalse(rangeStart, rangeEnd);
        List<RepairPayment> repairPayments = oversightRepairPaymentRepository.findByPaidAtBetween(rangeStart, rangeEnd);
        List<RepairJob> collectedJobs = repairJobRepository.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("status"), RepairJob.RepairStatus.COLLECTED),
                cb.greaterThanOrEqualTo(root.get("collectedAt"), rangeStart),
                cb.lessThanOrEqualTo(root.get("collectedAt"), rangeEnd)));

        // ---- Takings by payment method ------------------------------------------------------
        Map<String, PaymentMethodTakingsDto> byMethod = new LinkedHashMap<>();
        for (String method : PAYMENT_METHODS) {
            List<PosSale> methodSales = sales.stream().filter(s -> method.equals(s.getPaymentMethod())).toList();
            List<RepairPayment> methodPayments = repairPayments.stream().filter(p -> method.equals(p.getPaymentMethod())).toList();

            BigDecimal posAmount = methodSales.stream().map(PosSale::getNetCashAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal repairAmount = methodPayments.stream().map(RepairPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

            if (methodSales.isEmpty() && methodPayments.isEmpty()) {
                continue;
            }

            List<String> documents = new ArrayList<>(methodSales.stream().map(PosSale::getSaleNumber).toList());
            documents.addAll(methodPayments.stream()
                    .map(p -> repairJobRepository.findById(p.getRepairJobId()).map(RepairJob::getJobNumber).orElse(p.getId().toString()))
                    .toList());

            byMethod.put(method, new PaymentMethodTakingsDto(method, posAmount, methodSales.size(), repairAmount,
                    methodPayments.size(), posAmount.add(repairAmount), documents));
        }

        // ---- Trade-in cash payouts ------------------------------------------------------------
        List<PosTradeIn> cashPayouts = tradeIns.stream().filter(t -> "CASH".equals(t.getPayoutType())).toList();
        BigDecimal tradeInCashTotal = cashPayouts.stream().map(PosTradeIn::getPayoutTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        AmountWithDocumentsDto tradeInCashPayouts = new AmountWithDocumentsDto(tradeInCashTotal,
                cashPayouts.stream().map(PosTradeIn::getTradeInNumber).toList());

        // ---- Store credit issued vs redeemed ---------------------------------------------------
        List<PosTradeIn> creditIssuedList = tradeIns.stream().filter(t -> "STORE_CREDIT".equals(t.getPayoutType())).toList();
        BigDecimal creditIssuedTotal = creditIssuedList.stream().map(PosTradeIn::getPayoutTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        AmountWithDocumentsDto storeCreditIssued = new AmountWithDocumentsDto(creditIssuedTotal,
                creditIssuedList.stream().map(PosTradeIn::getTradeInNumber).toList());

        List<PosSale> creditRedeemedList = sales.stream()
                .filter(s -> s.getStoreCreditRedeemed() != null && s.getStoreCreditRedeemed().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        BigDecimal creditRedeemedTotal = creditRedeemedList.stream().map(PosSale::getStoreCreditRedeemed)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        AmountWithDocumentsDto storeCreditRedeemed = new AmountWithDocumentsDto(creditRedeemedTotal,
                creditRedeemedList.stream().map(PosSale::getSaleNumber).toList());

        // ---- Service revenue (collected repairs) -----------------------------------------------
        BigDecimal serviceRevenueTotal = collectedJobs.stream()
                .map(j -> j.getTotalCost() != null ? j.getTotalCost() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        AmountWithDocumentsDto serviceRevenue = new AmountWithDocumentsDto(serviceRevenueTotal,
                collectedJobs.stream().map(RepairJob::getJobNumber).toList());

        // ---- PoS goods revenue: subtotal - discountTotal (clamped >= 0), the same figure
        // PosSaleService recognized as Sales Revenue at creation time. ---------------------------
        BigDecimal posGoodsTotal = BigDecimal.ZERO;
        for (PosSale sale : sales) {
            BigDecimal recognized = sale.getSubtotal().subtract(sale.getDiscountTotal());
            if (recognized.compareTo(BigDecimal.ZERO) < 0) {
                recognized = BigDecimal.ZERO;
            }
            posGoodsTotal = posGoodsTotal.add(recognized);
        }
        AmountWithDocumentsDto posGoodsRevenue = new AmountWithDocumentsDto(posGoodsTotal,
                sales.stream().map(PosSale::getSaleNumber).toList());

        BigDecimal totalRevenue = posGoodsTotal.add(serviceRevenueTotal);

        // ---- COGS: goods sold (acquisitionCostSnapshot x qty) + repair parts consumed on
        // collected jobs. ------------------------------------------------------------------------
        BigDecimal cogsGoodsTotal = BigDecimal.ZERO;
        for (PosSale sale : sales) {
            for (PosSaleLine line : sale.getLines()) {
                if (line.getAcquisitionCostSnapshot() != null) {
                    cogsGoodsTotal = cogsGoodsTotal.add(line.getAcquisitionCostSnapshot().multiply(BigDecimal.valueOf(line.getQuantity())));
                }
            }
        }
        AmountWithDocumentsDto cogsGoods = new AmountWithDocumentsDto(cogsGoodsTotal,
                sales.stream().map(PosSale::getSaleNumber).toList());

        BigDecimal cogsRepairPartsTotal = BigDecimal.ZERO;
        for (RepairJob job : collectedJobs) {
            List<RepairPart> parts = repairPartRepository.findByRepairJobIdOrderByCreatedAtAsc(job.getId());
            for (RepairPart part : parts) {
                cogsRepairPartsTotal = cogsRepairPartsTotal.add(part.getUnitCost().multiply(BigDecimal.valueOf(part.getQuantity())));
            }
        }
        AmountWithDocumentsDto cogsRepairParts = new AmountWithDocumentsDto(cogsRepairPartsTotal,
                collectedJobs.stream().map(RepairJob::getJobNumber).toList());

        BigDecimal totalCogs = cogsGoodsTotal.add(cogsRepairPartsTotal);
        BigDecimal grossMargin = totalRevenue.subtract(totalCogs);

        // ---- Net cash movement: PoS net cash + repair payments actually received in cash-like
        // methods (excludes STORE_CREDIT, which never touches the till) - trade-in cash paid out. -
        BigDecimal posNetCash = sales.stream().map(PosSale::getNetCashAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal repairCashIn = repairPayments.stream()
                .filter(p -> !"STORE_CREDIT".equals(p.getPaymentMethod()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netCashMovement = posNetCash.add(repairCashIn).subtract(tradeInCashTotal);

        // ---- Posted-journal cross-check --------------------------------------------------------
        PostedJournalCrossCheckDto crossCheck = buildCrossCheck(from, to, totalRevenue);

        return new MoneyFlowResponseDto(from, to, new ArrayList<>(byMethod.values()), tradeInCashPayouts,
                storeCreditIssued, storeCreditRedeemed, serviceRevenue, posGoodsRevenue, totalRevenue,
                cogsGoods, cogsRepairParts, totalCogs, grossMargin, netCashMovement, crossCheck);
    }

    /**
     * WP (cash-leg split, V35): confirmed while splitting the single 1110 "Cash and Cash
     * Equivalents" account into 1111/1112/1113/1114 (see CashAccountResolver) that this
     * cross-check sums ONLY the Sales Revenue (4100) / Service Revenue (4200) credit-debit
     * activity - it never references 1110 or any cash/clearing account. The cash-account split
     * therefore does not require any change here: every posting site's revenue credit line
     * (4100/4200) is unaffected by which cash/clearing account its debit leg now resolves to, so
     * this cross-check cannot start reporting a false mismatch as a result of the split.
     *
     * <p><b>Fix (see {@link PostedJournalCrossCheckDto} javadoc for the full rationale, option
     * (a) chosen):</b> {@code operationalRevenue} passed in here is PoS goods + repair service
     * revenue only - it never included invoice revenue, even though every invoice posts a Sales
     * Revenue (4100) credit at creation time via {@code InvoiceService#createInvoiceJournalEntry}
     * regardless of the invoice's own DRAFT/SENT/PAID/OVERDUE/CANCELLED status. That meant
     * {@code postedRevenue} (summed straight from the ledger below) already included every
     * invoice's contribution while the operational side never did, so on any environment with
     * real invoice activity this permanently reported {@code matchesOperational == false} for a
     * reason that had nothing to do with unposted drafts - a warning that is always on is worse
     * than none. Fixed by adding each period's invoice totals
     * ({@link OversightInvoiceRepository#findByInvoiceDateBetweenAndDeletedFalse}) into the
     * comparable operational figure used ONLY for this cross-check - the {@code totalRevenue}
     * headline figure returned to the caller (used for gross margin, which has no invoice-side
     * COGS to net against) is left untouched.
     *
     * <p><b>Second fix (WEBSHOP verification-gate, same class of bug, same narrow remedy):</b>
     * {@code ShopOrderService#fulfilOrder} posts a real Sales Revenue (4100) credit the moment a
     * web order is handed over/dispatched - proven live during the WEBSHOP verification gate: a
     * single fulfilled RM250 web order made this cross-check report {@code matchesOperational:
     * false} with no unposted-draft explanation, because {@code operationalRevenue} (passed in
     * from {@link #getMoneyFlow}) never counted it - only PoS goods + repair service revenue.
     * Folded FULFILLED {@link ShopOrder} totals into {@code comparableOperationalRevenue} here,
     * same narrow scope as the invoice fix above: this cross-check only, not the headline {@code
     * totalRevenue}/payment-method breakdown/COGS figures returned to the caller, which still do
     * not attribute web-order sales anywhere in the day-book (a real, larger reporting gap - e.g.
     * which payment-method bucket a PAY_AT_COLLECTION web sale's cash lands in, since {@code
     * fulfilOrder} always resolves it through {@code CashAccountResolver} to CASH regardless of
     * how the customer actually paid at the till - deliberately left for a follow-up task rather
     * than folded into this narrow, safe fix).
     *
     * <p>The banner must also still fire for the ORIGINAL reason this cross-check exists: an
     * unposted DRAFT entry touching revenue accounts for the period (in practice, with
     * auto-posting on by default, this can now only be a manual entry - see the {@code
     * accounting} skill's auto-posting policy). Such a draft doesn't move {@code postedRevenue}
     * (only POSTED activity is summed) or {@code comparableOperationalRevenue} (it isn't PoS/
     * invoice/repair activity), so the two raw sums can agree even while a draft sits there about
     * to change the picture once posted - so DRAFT entries touching 4100/4200 are looked up
     * unconditionally (not just when the raw sums already disagree) and treated as a mismatch in
     * their own right, named explicitly rather than left to a bare "mismatch" flag.
     */
    private PostedJournalCrossCheckDto buildCrossCheck(LocalDate from, LocalDate to, BigDecimal operationalRevenue) {
        Optional<Account> salesRevenueAccount = accountRepository.findByCodeAndDeletedFalse(SALES_REVENUE_ACCOUNT_CODE);
        Optional<Account> serviceRevenueAccount = accountRepository.findByCodeAndDeletedFalse(SERVICE_REVENUE_ACCOUNT_CODE);

        List<Object[]> activity = journalEntryLineRepository.sumActivityByAccountBetweenDates(from, to);
        BigDecimal postedRevenue = BigDecimal.ZERO;
        for (Object[] row : activity) {
            Object accountId = row[0];
            BigDecimal debit = (BigDecimal) row[1];
            BigDecimal credit = (BigDecimal) row[2];
            boolean isRevenueAccount = salesRevenueAccount.map(a -> a.getId().equals(accountId)).orElse(false)
                    || serviceRevenueAccount.map(a -> a.getId().equals(accountId)).orElse(false);
            if (isRevenueAccount) {
                postedRevenue = postedRevenue.add(credit.subtract(debit));
            }
        }

        // Option (a): fold invoice revenue into the operational side so both sides cover the same
        // ground - see this method's javadoc and PostedJournalCrossCheckDto's javadoc.
        List<Invoice> invoicesInPeriod = oversightInvoiceRepository.findByInvoiceDateBetweenAndDeletedFalse(from, to);
        BigDecimal invoiceRevenue = invoicesInPeriod.stream()
                .map(Invoice::getTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Second fix, same narrow scope - see this method's javadoc "Second fix" paragraph. Filtered
        // on updatedAt (the fulfilment write - ShopOrder has no dedicated fulfilledAt column), not
        // createdAt (reservation time), since that's when the revenue journal is actually posted.
        List<ShopOrder> fulfilledWebOrdersInPeriod = shopOrderRepository.findByStatusAndUpdatedAtBetween(
                ShopOrder.OrderStatus.FULFILLED, from.atStartOfDay(), to.atTime(LocalTime.MAX));
        BigDecimal webOrderRevenue = fulfilledWebOrdersInPeriod.stream()
                .map(ShopOrder::getTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal comparableOperationalRevenue = operationalRevenue.add(invoiceRevenue).add(webOrderRevenue);

        boolean figuresMatch = postedRevenue.compareTo(comparableOperationalRevenue) == 0;

        List<JournalEntry> draftsInPeriod = oversightJournalEntryRepository
                .findByStatusAndEntryDateBetweenAndDeletedFalse(JournalEntry.JournalEntryStatus.DRAFT, from, to);
        List<String> unpostedDraftRevenueEntryNumbers = draftsInPeriod.stream()
                .filter(entry -> entry.getLines().stream().anyMatch(line -> {
                    Object accountId = line.getAccount().getId();
                    return salesRevenueAccount.map(a -> a.getId().equals(accountId)).orElse(false)
                            || serviceRevenueAccount.map(a -> a.getId().equals(accountId)).orElse(false);
                }))
                .map(JournalEntry::getEntryNumber)
                .toList();

        boolean matches = figuresMatch && unpostedDraftRevenueEntryNumbers.isEmpty();

        String note;
        if (matches) {
            note = "Posted journal revenue (Sales 4100 + Service 4200) matches the operational figure "
                    + "(PoS goods + repair service + invoice + fulfilled web order revenue) for this period.";
        } else if (!unpostedDraftRevenueEntryNumbers.isEmpty()) {
            boolean singular = unpostedDraftRevenueEntryNumbers.size() == 1;
            note = "Posted journal revenue does not match the operational figure - "
                    + unpostedDraftRevenueEntryNumbers.size() + " unposted DRAFT journal entr" + (singular ? "y" : "ies")
                    + " affecting revenue for this period " + (singular ? "has" : "have")
                    + " not been posted yet (see Accounting > Post Drafts): "
                    + String.join(", ", unpostedDraftRevenueEntryNumbers) + ".";
        } else {
            note = "Posted journal revenue does not match the operational figure for this period, and no "
                    + "unposted DRAFT entry affecting revenue accounts was found to explain it - check for a "
                    + "manual posting error.";
        }

        return new PostedJournalCrossCheckDto(comparableOperationalRevenue, postedRevenue, matches, note,
                unpostedDraftRevenueEntryNumbers.size(), unpostedDraftRevenueEntryNumbers);
    }
}
