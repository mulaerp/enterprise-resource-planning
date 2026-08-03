package com.mulaerp.voucher.service;

import com.mulaerp.voucher.dto.CreateVoucherRequest;
import com.mulaerp.voucher.dto.VoucherDto;
import com.mulaerp.voucher.dto.VoucherValidateResponse;
import com.mulaerp.voucher.entity.Voucher;
import com.mulaerp.voucher.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VoucherService {

    private static final Set<String> ALLOWED_TYPES = Set.of("PERCENT", "FIXED");

    private final VoucherRepository voucherRepository;

    @Transactional(readOnly = true)
    public Page<VoucherDto> getAllVouchers(Pageable pageable) {
        return voucherRepository.findByDeletedFalse(pageable).map(this::toDto);
    }

    @Transactional
    public VoucherDto createVoucher(CreateVoucherRequest request) {
        String code = normalize(request.getCode());
        if (voucherRepository.existsByCodeAndDeletedFalse(code)) {
            throw new IllegalStateException("Voucher code already exists: " + code);
        }

        String type = request.getType() == null ? "" : request.getType().trim().toUpperCase();
        if (!ALLOWED_TYPES.contains(type)) {
            throw new IllegalArgumentException("Voucher type must be one of " + ALLOWED_TYPES);
        }

        Voucher voucher = new Voucher();
        voucher.setCode(code);
        voucher.setType(type);
        voucher.setValue(request.getValue());
        voucher.setMinSpend(request.getMinSpend());
        voucher.setExpiresAt(request.getExpiresAt());
        voucher.setUsageLimit(request.getUsageLimit());
        voucher.setUsedCount(0);
        voucher.setActive(request.getActive() != null ? request.getActive() : true);

        return toDto(voucherRepository.save(voucher));
    }

    /**
     * Read-only check used by POST /vouchers/validate. This is a query, not a mutation - an
     * ineligible voucher (not found/expired/usage-limit/min-spend) comes back as valid=false
     * with a human message, HTTP 200, rather than throwing.
     */
    @Transactional(readOnly = true)
    public VoucherValidateResponse validateVoucher(String code, BigDecimal subtotal) {
        Optional<Voucher> found = voucherRepository.findByCodeAndDeletedFalse(normalize(code));
        if (found.isEmpty()) {
            return invalidResponse(code, "Voucher not found");
        }

        Voucher voucher = found.get();
        String failureMessage = checkEligibility(voucher, subtotal);
        if (failureMessage != null) {
            return invalidResponse(voucher.getCode(), failureMessage);
        }

        BigDecimal discount = computeDiscount(voucher, subtotal);
        VoucherValidateResponse response = new VoucherValidateResponse();
        response.setValid(true);
        response.setCode(voucher.getCode());
        response.setType(voucher.getType());
        response.setValue(voucher.getValue());
        response.setDiscountAmount(discount);
        response.setMessage("Voucher applied");
        return response;
    }

    /**
     * Validates a voucher against a subtotal and, if eligible, atomically increments its
     * usedCount - used at PoS sale time (contract: "validate + increment usedCount
     * atomically"). Throws IllegalArgumentException (mapped to HTTP 400) on any ineligible
     * voucher, since an invalid voucher supplied on an actual sale is a client error, unlike
     * the read-only /validate query endpoint.
     */
    @Transactional
    public VoucherApplication applyVoucher(String code, BigDecimal subtotal) {
        Voucher voucher = voucherRepository.findByCodeAndDeletedFalse(normalize(code))
                .orElseThrow(() -> new IllegalArgumentException("Voucher not found: " + code));

        String failureMessage = checkEligibility(voucher, subtotal);
        if (failureMessage != null) {
            throw new IllegalArgumentException(failureMessage);
        }

        BigDecimal discount = computeDiscount(voucher, subtotal);
        voucher.setUsedCount(voucher.getUsedCount() + 1);
        voucherRepository.save(voucher);

        return new VoucherApplication(voucher.getCode(), discount);
    }

    /**
     * V34: reverses the usedCount increment from {@link #applyVoucher} when the sale that
     * consumed it is voided. Clamped at zero (never negative) and silently a no-op if the code
     * can no longer be found (e.g. hard-deleted since - can't happen via the normal soft-delete
     * path, but this must never fail a void over a voucher-bookkeeping detail).
     */
    @Transactional
    public void releaseUsage(String code) {
        voucherRepository.findByCodeAndDeletedFalse(normalize(code)).ifPresent(voucher -> {
            voucher.setUsedCount(Math.max(0, voucher.getUsedCount() - 1));
            voucherRepository.save(voucher);
        });
    }

    /** Null if eligible; otherwise a human-readable reason (not found/expired/usage limit/min spend). */
    private String checkEligibility(Voucher voucher, BigDecimal subtotal) {
        if (!Boolean.TRUE.equals(voucher.getActive())) {
            return "Voucher is inactive";
        }
        if (voucher.getExpiresAt() != null && voucher.getExpiresAt().isBefore(LocalDate.now())) {
            return "Voucher has expired";
        }
        if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit()) {
            return "Voucher usage limit reached";
        }
        if (voucher.getMinSpend() != null && subtotal.compareTo(voucher.getMinSpend()) < 0) {
            return "Minimum spend of " + voucher.getMinSpend() + " not met";
        }
        return null;
    }

    private BigDecimal computeDiscount(Voucher voucher, BigDecimal subtotal) {
        BigDecimal discount = "PERCENT".equals(voucher.getType())
                ? subtotal.multiply(voucher.getValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : voucher.getValue();

        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;
        }
        if (discount.compareTo(BigDecimal.ZERO) < 0) {
            discount = BigDecimal.ZERO;
        }
        return discount;
    }

    private VoucherValidateResponse invalidResponse(String code, String message) {
        VoucherValidateResponse response = new VoucherValidateResponse();
        response.setValid(false);
        response.setCode(code);
        response.setDiscountAmount(BigDecimal.ZERO);
        response.setMessage(message);
        return response;
    }

    private String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private VoucherDto toDto(Voucher voucher) {
        VoucherDto dto = new VoucherDto();
        dto.setId(voucher.getId());
        dto.setCode(voucher.getCode());
        dto.setType(voucher.getType());
        dto.setValue(voucher.getValue());
        dto.setMinSpend(voucher.getMinSpend());
        dto.setExpiresAt(voucher.getExpiresAt());
        dto.setUsageLimit(voucher.getUsageLimit());
        dto.setUsedCount(voucher.getUsedCount());
        dto.setActive(voucher.getActive());
        dto.setCreatedAt(voucher.getCreatedAt());
        dto.setUpdatedAt(voucher.getUpdatedAt());
        return dto;
    }

    /** Result of a successful applyVoucher call: the normalized code and the discount to apply. */
    public record VoucherApplication(String code, BigDecimal discountAmount) {}
}
