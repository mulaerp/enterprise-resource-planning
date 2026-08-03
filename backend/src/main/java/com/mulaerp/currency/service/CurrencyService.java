package com.mulaerp.currency.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.currency.dto.CurrencyDto;
import com.mulaerp.currency.entity.Currency;
import com.mulaerp.currency.repository.CurrencyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Staff-facing currency management. MYR is the fixed base currency (see V25 migration) - its rate
 * can never be changed away from 1.0, enforced in #updateRate rather than at the DB layer so the
 * failure surfaces as a normal 400 through GlobalExceptionHandler's IllegalArgumentException
 * mapping, not a constraint violation.
 *
 * <p>V31 (automatic FX rates) precedence rule: a manual {@code PUT} always sets
 * {@code rateSource=MANUAL} immediately and takes effect straight away - it is never rejected or
 * silently dropped. What it protects against is the REVERSE: the scheduled/manual-trigger AUTO
 * refresh (see {@code FxRateRefreshService}/{@code CurrencyRateApplier}) will not overwrite a
 * currency that was manually edited on the same calendar day (Asia/Kuala_Lumpur) AND that has been
 * under AUTO management at least once before (rateFetchedAt already set) - it starts overwriting
 * it again only from the next scheduled day onward. A currency still on its pristine,
 * never-yet-auto-fetched default is not protected by this rule (nothing to protect it from yet)
 * and is eligible for its very first auto-fetch immediately - see CurrencyRateApplier javadoc.
 * This is a deliberate, simple choice over more elaborate alternatives (e.g. a permanent "pin to
 * manual" flag) - it means an operator's same-day correction always sticks, while the rate still
 * self-heals back onto the live feed the next day rather than drifting further from market
 * indefinitely if forgotten.
 */
@Service
@RequiredArgsConstructor
public class CurrencyService {

    private static final String BASE_CURRENCY_CODE = "MYR";
    private static final String RATE_SOURCE_MANUAL = "MANUAL";

    private final CurrencyRepository currencyRepository;

    @Transactional(readOnly = true)
    public List<CurrencyDto> getAllCurrencies() {
        return currencyRepository.findByDeletedFalseOrderByCodeAsc().stream()
                .map(CurrencyDto::fromEntity)
                .toList();
    }

    @Transactional
    public CurrencyDto updateRate(String code, BigDecimal rate) {
        Currency currency = getEntity(code);

        if (BASE_CURRENCY_CODE.equalsIgnoreCase(currency.getCode()) && rate.compareTo(BigDecimal.ONE) != 0) {
            throw new IllegalArgumentException("The base currency (MYR) rate cannot be changed away from 1.0");
        }

        currency.setRate(rate);
        currency.setRateSource(RATE_SOURCE_MANUAL);
        return CurrencyDto.fromEntity(currencyRepository.save(currency));
    }

    private Currency getEntity(String code) {
        return currencyRepository.findByCodeIgnoreCaseAndDeletedFalse(code)
                .orElseThrow(() -> new ResourceNotFoundException("Currency not found: " + code));
    }
}
