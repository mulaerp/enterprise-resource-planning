package com.mulaerp.oversight.service;

import com.mulaerp.auth.repository.UserRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.member.entity.Member;
import com.mulaerp.member.repository.MemberRepository;
import com.mulaerp.oversight.dto.MyDayDiscountsDto;
import com.mulaerp.oversight.dto.MyDayPaymentMethodDto;
import com.mulaerp.oversight.dto.MyDayRepairPaymentsDto;
import com.mulaerp.oversight.dto.MyDayResponseDto;
import com.mulaerp.oversight.dto.MyDaySaleDto;
import com.mulaerp.oversight.dto.MyDayTradeInSummaryDto;
import com.mulaerp.oversight.dto.MyDayVoidedSalesDto;
import com.mulaerp.oversight.exception.OwnDayOnlyException;
import com.mulaerp.oversight.repository.OversightPosSaleRepository;
import com.mulaerp.oversight.repository.OversightPosTradeInRepository;
import com.mulaerp.oversight.repository.OversightRepairPaymentRepository;
import com.mulaerp.pos.entity.PosSale;
import com.mulaerp.pos.entity.PosSaleLine;
import com.mulaerp.pos.entity.PosTradeIn;
import com.mulaerp.repair.entity.RepairPayment;
import com.mulaerp.voucher.entity.Voucher;
import com.mulaerp.voucher.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * "My Day" - a cashier's own shift report, so a cashier can reconcile their own till before
 * handover without needing manager-only visibility (money-flow/cash-up are both
 * {@code RoleRules#MANAGER_UP}). Sourced entirely from OPERATIONAL tables (PoS sales, trade-ins,
 * repair payments), same tables and pattern as {@link MoneyFlowService}/{@link CashUpService} -
 * never from journal entries.
 *
 * <h2>Scoping (enforced here, not just at the controller)</h2>
 * <ul>
 *   <li><b>CASHIER</b> may only ever see their OWN day - a {@code username} parameter naming
 *   anyone else is rejected with a clear 403 ({@link OwnDayOnlyException}), not silently
 *   ignored or downgraded to their own day (an explicit reject makes a caller's mistaken
 *   assumption visible instead of masking it).</li>
 *   <li><b>MANAGER/ADMIN</b> may pass {@code username} to view any cashier's day; omitting it
 *   shows their own (a manager who rings up a sale themselves can reconcile their own till too).</li>
 *   <li><b>ACCOUNTANT/INVENTORY</b>: same rule as CASHIER (own day only) - harmless (they have no
 *   legitimate reason to look up someone else's till) and consistent with the "no dedicated role
 *   for this" default.</li>
 * </ul>
 * The default/self identity always comes from {@link SecurityContextHolder}'s authenticated
 * principal - a client-supplied identity is never trusted on its own; it is only ever accepted
 * as an ADDITIONAL override once the caller is confirmed MANAGER/ADMIN.
 *
 * <h2>DELIBERATELY EXCLUDED: COGS, margin, cost price</h2>
 * That is manager/owner information (see {@link com.mulaerp.oversight.dto.MoneyFlowResponseDto}) -
 * a cashier reconciling their own drawer has no legitimate need to see what the shop paid for what
 * it sold. No field on this response is, or is derived from, {@code acquisitionCostSnapshot} or
 * {@code costPrice}.
 *
 * <h2>{@code expectedCashInDrawer} formula</h2>
 * {@code cash sales (netCashAmount, COMPLETED sales, CASH method) - cash trade-in payouts
 * (payoutType CASH) - cash refunds (RepairPayment rows with isRefund=true, paymentMethod CASH,
 * refundedBy this cashier)}. A void pulls this down too: the voided sale is excluded from "cash
 * sales" entirely (status filter), so if a CASH sale rung up earlier today gets voided later
 * today, expectedCashInDrawer drops by that sale's netCashAmount on the very next GET - exactly
 * mirroring the physical reality (the cash was handed back / never left the till in the first
 * place from the till's point of view once reversed).
 */
@Service
@RequiredArgsConstructor
public class MyDayService {

    private static final Set<String> PAYMENT_METHODS = Set.of("CASH", "CARD", "EWALLET", "STORE_CREDIT");
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_VOIDED = "VOIDED";

    private final OversightPosSaleRepository oversightPosSaleRepository;
    private final OversightPosTradeInRepository oversightPosTradeInRepository;
    private final OversightRepairPaymentRepository oversightRepairPaymentRepository;
    private final MemberRepository memberRepository;
    private final VoucherRepository voucherRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public MyDayResponseDto getMyDay(LocalDate date, String requestedUsername) {
        String targetUsername = resolveTargetUsername(requestedUsername);

        LocalDateTime rangeStart = date.atStartOfDay();
        LocalDateTime rangeEnd = date.atTime(LocalTime.MAX);

        List<PosSale> allSales = oversightPosSaleRepository
                .findByCreatedAtBetweenAndCreatedByAndDeletedFalse(rangeStart, rangeEnd, targetUsername);
        List<PosSale> completedSales = allSales.stream().filter(s -> STATUS_COMPLETED.equals(s.getStatus())).toList();
        List<PosSale> voidedSales = allSales.stream().filter(s -> STATUS_VOIDED.equals(s.getStatus())).toList();

        List<PosTradeIn> tradeIns = oversightPosTradeInRepository
                .findByCreatedAtBetweenAndCreatedByAndDeletedFalse(rangeStart, rangeEnd, targetUsername);

        List<RepairPayment> repairCollections = oversightRepairPaymentRepository
                .findByPaidAtBetweenAndCreatedByAndIsRefundFalse(rangeStart, rangeEnd, targetUsername);
        List<RepairPayment> repairRefunds = oversightRepairPaymentRepository
                .findByPaidAtBetweenAndRefundedByAndIsRefundTrue(rangeStart, rangeEnd, targetUsername);

        // ---- Sale count / items sold / takings by method (COMPLETED only) --------------------
        int saleCount = completedSales.size();
        int itemsSold = completedSales.stream()
                .flatMap(s -> s.getLines().stream())
                .mapToInt(PosSaleLine::getQuantity)
                .sum();

        List<MyDayPaymentMethodDto> takingsByMethod = new ArrayList<>();
        BigDecimal grossTakings = BigDecimal.ZERO;
        for (String method : PAYMENT_METHODS) {
            List<PosSale> methodSales = completedSales.stream().filter(s -> method.equals(s.getPaymentMethod())).toList();
            if (methodSales.isEmpty()) {
                continue;
            }
            BigDecimal amount = methodSales.stream().map(PosSale::getNetCashAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            takingsByMethod.add(new MyDayPaymentMethodDto(method, amount, methodSales.size()));
            grossTakings = grossTakings.add(amount);
        }

        BigDecimal averageBasket = saleCount > 0
                ? grossTakings.divide(BigDecimal.valueOf(saleCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // ---- Discounts given (member + voucher + cart) - see MyDayDiscountsDto javadoc for the
        // approximation this necessarily makes. ------------------------------------------------
        BigDecimal memberDiscountTotal = BigDecimal.ZERO;
        BigDecimal voucherDiscountTotal = BigDecimal.ZERO;
        BigDecimal cartDiscountTotal = BigDecimal.ZERO;
        for (PosSale sale : completedSales) {
            DiscountBreakdown breakdown = computeDiscountBreakdown(sale);
            memberDiscountTotal = memberDiscountTotal.add(breakdown.memberDiscount());
            voucherDiscountTotal = voucherDiscountTotal.add(breakdown.voucherDiscount());
            cartDiscountTotal = cartDiscountTotal.add(breakdown.cartDiscount());
        }
        BigDecimal discountTotal = memberDiscountTotal.add(voucherDiscountTotal).add(cartDiscountTotal);
        MyDayDiscountsDto discountsGiven = new MyDayDiscountsDto(memberDiscountTotal, voucherDiscountTotal, cartDiscountTotal, discountTotal);

        // ---- Trade-ins processed ---------------------------------------------------------------
        BigDecimal tradeInCashPaidOut = tradeIns.stream()
                .filter(t -> "CASH".equals(t.getPayoutType()))
                .map(PosTradeIn::getPayoutTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tradeInStoreCreditIssued = tradeIns.stream()
                .filter(t -> "STORE_CREDIT".equals(t.getPayoutType()))
                .map(PosTradeIn::getPayoutTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        MyDayTradeInSummaryDto tradeInsProcessed = new MyDayTradeInSummaryDto(tradeIns.size(), tradeInCashPaidOut, tradeInStoreCreditIssued);

        // ---- Store credit redeemed (COMPLETED sales only) --------------------------------------
        BigDecimal storeCreditRedeemed = completedSales.stream()
                .map(PosSale::getStoreCreditRedeemed)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ---- Voided sales -----------------------------------------------------------------------
        BigDecimal voidedValue = voidedSales.stream()
                .map(s -> s.getNetCashAmount() != null ? s.getNetCashAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        MyDayVoidedSalesDto voidedSalesDto = new MyDayVoidedSalesDto(voidedSales.size(), voidedValue);

        // ---- Repair payments collected ----------------------------------------------------------
        BigDecimal repairPaymentsValue = repairCollections.stream().map(RepairPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        MyDayRepairPaymentsDto repairPaymentsCollected = new MyDayRepairPaymentsDto(repairCollections.size(), repairPaymentsValue);

        // ---- Expected cash in drawer - see this class's javadoc for the formula. --------------
        BigDecimal cashSales = completedSales.stream()
                .filter(s -> "CASH".equals(s.getPaymentMethod()))
                .map(PosSale::getNetCashAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cashTradeInPayouts = tradeInCashPaidOut;
        BigDecimal cashRefunds = repairRefunds.stream()
                .filter(p -> "CASH".equals(p.getPaymentMethod()))
                .map(RepairPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expectedCashInDrawer = cashSales.subtract(cashTradeInPayouts).subtract(cashRefunds);

        // ---- Drill-down sale list (COMPLETED + VOIDED, newest first) ---------------------------
        List<MyDaySaleDto> saleLines = allSales.stream()
                .sorted(Comparator.comparing(PosSale::getCreatedAt).reversed())
                .map(s -> new MyDaySaleDto(s.getSaleNumber(), s.getCreatedAt(), s.getNetCashAmount(), s.getPaymentMethod(), s.getStatus()))
                .toList();

        return new MyDayResponseDto(date, targetUsername, saleCount, itemsSold, grossTakings, takingsByMethod,
                averageBasket, discountsGiven, tradeInsProcessed, storeCreditRedeemed, voidedSalesDto,
                repairPaymentsCollected, expectedCashInDrawer, saleLines);
    }

    /**
     * Resolves who this report is actually for, enforcing the scoping rule in this class's
     * javadoc. The authenticated principal ({@link SecurityContextHolder}) is always the source of
     * "who is asking" and the default "whose day" - {@code requestedUsername} is only ever honoured
     * as an override once the caller is confirmed MANAGER/ADMIN.
     */
    private String resolveTargetUsername(String requestedUsername) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String callerUsername = (authentication != null) ? authentication.getName() : null;
        if (callerUsername == null || callerUsername.isBlank()) {
            throw new OwnDayOnlyException("No authenticated user found");
        }

        boolean managerUp = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> authority.equals("ROLE_MANAGER") || authority.equals("ROLE_ADMIN"));

        if (requestedUsername == null || requestedUsername.isBlank()) {
            return callerUsername;
        }

        String trimmed = requestedUsername.trim();
        if (!managerUp) {
            if (!trimmed.equalsIgnoreCase(callerUsername)) {
                throw new OwnDayOnlyException(
                        "You may only view your own day's report - ask a manager to view another staff member's day");
            }
            return callerUsername;
        }

        // MANAGER/ADMIN: honour the requested username, but it must be a real (non-deleted) user.
        userRepository.findByEmailAndDeletedFalse(trimmed)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + trimmed));
        return trimmed;
    }

    private record DiscountBreakdown(BigDecimal memberDiscount, BigDecimal voucherDiscount, BigDecimal cartDiscount) {
    }

    /** See {@link MyDayDiscountsDto} javadoc for the approximation this necessarily makes. */
    private DiscountBreakdown computeDiscountBreakdown(PosSale sale) {
        BigDecimal subtotal = sale.getSubtotal() != null ? sale.getSubtotal() : BigDecimal.ZERO;
        BigDecimal discountTotal = sale.getDiscountTotal() != null ? sale.getDiscountTotal() : BigDecimal.ZERO;

        BigDecimal memberDiscount = BigDecimal.ZERO;
        if (sale.getMemberId() != null) {
            Optional<Member> member = memberRepository.findByIdAndDeletedFalse(sale.getMemberId());
            if (member.isPresent() && member.get().getDiscountPercent() != null
                    && member.get().getDiscountPercent().compareTo(BigDecimal.ZERO) > 0) {
                memberDiscount = subtotal.multiply(member.get().getDiscountPercent())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            }
        }
        // Defensive clamp: the recomputed memberDiscount can never exceed what was actually
        // recorded on the sale (guards against the tier-drift approximation over-attributing).
        if (memberDiscount.compareTo(discountTotal) > 0) {
            memberDiscount = discountTotal;
        }

        BigDecimal afterMember = clampToZero(subtotal.subtract(memberDiscount));

        BigDecimal voucherDiscount = BigDecimal.ZERO;
        if (sale.getVoucherCode() != null && !sale.getVoucherCode().isBlank()) {
            Optional<Voucher> voucher = voucherRepository.findByCodeAndDeletedFalse(sale.getVoucherCode());
            if (voucher.isPresent()) {
                Voucher v = voucher.get();
                voucherDiscount = "PERCENT".equals(v.getType())
                        ? afterMember.multiply(v.getValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                        : v.getValue();
                if (voucherDiscount.compareTo(afterMember) > 0) {
                    voucherDiscount = afterMember;
                }
                if (voucherDiscount.compareTo(BigDecimal.ZERO) < 0) {
                    voucherDiscount = BigDecimal.ZERO;
                }
            }
        }
        BigDecimal remainderAfterVoucher = discountTotal.subtract(memberDiscount).subtract(voucherDiscount);
        if (voucherDiscount.compareTo(discountTotal.subtract(memberDiscount)) > 0) {
            voucherDiscount = clampToZero(discountTotal.subtract(memberDiscount));
            remainderAfterVoucher = BigDecimal.ZERO;
        }

        BigDecimal cartDiscount = clampToZero(remainderAfterVoucher);

        return new DiscountBreakdown(memberDiscount, voucherDiscount, cartDiscount);
    }

    private BigDecimal clampToZero(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : value;
    }
}
