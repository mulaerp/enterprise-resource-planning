package com.mulaerp.oversight.service;

import com.mulaerp.oversight.dto.CashUpLineDto;
import com.mulaerp.oversight.dto.CashUpResponseDto;
import com.mulaerp.oversight.dto.SaveCashUpRequest;
import com.mulaerp.oversight.entity.CashUp;
import com.mulaerp.oversight.repository.CashUpRepository;
import com.mulaerp.oversight.repository.OversightPosSaleRepository;
import com.mulaerp.oversight.repository.OversightPosTradeInRepository;
import com.mulaerp.oversight.repository.OversightRepairPaymentRepository;
import com.mulaerp.pos.entity.PosSale;
import com.mulaerp.pos.entity.PosTradeIn;
import com.mulaerp.repair.entity.RepairPayment;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
import java.util.Optional;
import java.util.Set;

/**
 * Cash-up / Z-report: {@code expected} per payment method is always recomputed server-side from
 * operational tables (PoS sales net cash + repair payments received - trade-in CASH payouts for
 * CASH specifically), never trusted from the client - see {@link CashUp} javadoc. A saved row
 * persists {@code counted}/{@code notes} plus the stamped approver.
 */
@Service
@RequiredArgsConstructor
public class CashUpService {

    private static final List<String> PAYMENT_METHODS = List.of("CASH", "CARD", "EWALLET", "STORE_CREDIT");

    private final CashUpRepository cashUpRepository;
    private final OversightPosSaleRepository oversightPosSaleRepository;
    private final OversightPosTradeInRepository oversightPosTradeInRepository;
    private final OversightRepairPaymentRepository oversightRepairPaymentRepository;

    @Transactional(readOnly = true)
    public CashUpResponseDto getCashUp(LocalDate date) {
        Map<String, BigDecimal> expected = computeExpected(date);
        List<CashUp> saved = cashUpRepository.findByCashUpDateAndDeletedFalse(date);

        List<CashUpLineDto> lines = new ArrayList<>();
        for (String method : PAYMENT_METHODS) {
            BigDecimal expectedAmount = expected.get(method);
            Optional<CashUp> existing = saved.stream().filter(c -> c.getPaymentMethod().equals(method)).findFirst();
            if (existing.isPresent()) {
                CashUp cashUp = existing.get();
                lines.add(new CashUpLineDto(method, expectedAmount, cashUp.getCounted(),
                        cashUp.getCounted().subtract(expectedAmount), cashUp.getNotes(),
                        cashUp.getApprovedBy(), cashUp.getApprovedAt(), true));
            } else {
                lines.add(new CashUpLineDto(method, expectedAmount, BigDecimal.ZERO, null, null, null, null, false));
            }
        }
        return new CashUpResponseDto(date, lines);
    }

    @Transactional
    public CashUpResponseDto saveCashUp(SaveCashUpRequest request) {
        LocalDate date = request.getDate();
        Map<String, BigDecimal> expected = computeExpected(date);

        String approver = currentUsername();
        LocalDateTime now = LocalDateTime.now();

        for (SaveCashUpRequest.CountEntry entry : request.getCounts()) {
            String method = entry.getPaymentMethod() == null ? "" : entry.getPaymentMethod().trim().toUpperCase();
            if (!PAYMENT_METHODS.contains(method)) {
                throw new IllegalArgumentException("paymentMethod must be one of " + PAYMENT_METHODS);
            }
            BigDecimal expectedAmount = expected.get(method);

            CashUp cashUp = cashUpRepository.findByCashUpDateAndPaymentMethodAndDeletedFalse(date, method)
                    .orElseGet(() -> {
                        CashUp created = new CashUp();
                        created.setCashUpDate(date);
                        created.setPaymentMethod(method);
                        return created;
                    });

            cashUp.setExpected(expectedAmount);
            cashUp.setCounted(entry.getCounted());
            cashUp.setVariance(entry.getCounted().subtract(expectedAmount));
            cashUp.setNotes(entry.getNotes());
            cashUp.setApprovedBy(approver);
            cashUp.setApprovedAt(now);
            cashUpRepository.save(cashUp);
        }

        return getCashUp(date);
    }

    /** CASH additionally nets off standalone CASH trade-in payouts (money paid out of the till). */
    private Map<String, BigDecimal> computeExpected(LocalDate date) {
        LocalDateTime rangeStart = date.atStartOfDay();
        LocalDateTime rangeEnd = date.atTime(LocalTime.MAX);

        List<PosSale> sales = oversightPosSaleRepository.findByCreatedAtBetweenAndDeletedFalse(rangeStart, rangeEnd);
        List<RepairPayment> repairPayments = oversightRepairPaymentRepository.findByPaidAtBetween(rangeStart, rangeEnd);
        List<PosTradeIn> tradeIns = oversightPosTradeInRepository.findByCreatedAtBetweenAndDeletedFalse(rangeStart, rangeEnd);

        Map<String, BigDecimal> expected = new LinkedHashMap<>();
        for (String method : PAYMENT_METHODS) {
            BigDecimal posAmount = sales.stream()
                    .filter(s -> method.equals(s.getPaymentMethod()))
                    .map(PosSale::getNetCashAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal repairAmount = repairPayments.stream()
                    .filter(p -> method.equals(p.getPaymentMethod()))
                    .map(RepairPayment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal amount = posAmount.add(repairAmount);

            if ("CASH".equals(method)) {
                BigDecimal cashPayouts = tradeIns.stream()
                        .filter(t -> "CASH".equals(t.getPayoutType()))
                        .map(PosTradeIn::getPayoutTotal)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                amount = amount.subtract(cashPayouts);
            }
            expected.put(method, amount);
        }
        return expected;
    }

    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            return "system";
        }
        return authentication.getName();
    }
}
