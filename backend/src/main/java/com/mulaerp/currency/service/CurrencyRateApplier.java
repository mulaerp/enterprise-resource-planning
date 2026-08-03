package com.mulaerp.currency.service;

import com.mulaerp.currency.entity.Currency;
import com.mulaerp.currency.repository.CurrencyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Applies a fetched code -&gt; rate map to the {@code currencies} table in its own transaction,
 * separate from {@link FxRateProviderClient}'s network call (which must never hold a DB
 * connection/transaction open for the duration of an HTTP request).
 *
 * <p>Rules enforced here (see V31 migration and {@code CurrencyService#updateRate} javadoc for
 * the full precedence rationale):
 * <ul>
 *   <li>MYR (the base currency) is never touched - its rate stays fixed at 1.0.
 *   <li>A currency last set by a manual PUT ({@code rateSource=MANUAL}) on the SAME calendar day
 *       (Asia/Kuala_Lumpur), AND which has previously been under AUTO management at least once
 *       ({@code rateFetchedAt != null}), is skipped - the operator's same-day override of a
 *       previously-automated rate is not silently overwritten. It resumes being auto-refreshed
 *       from the next scheduled day onward. The {@code rateFetchedAt != null} condition matters:
 *       a currency's pristine, never-yet-auto-fetched default (e.g. every existing row
 *       immediately after the V31 migration backfills {@code rate_source='MANUAL'}) is NOT a
 *       "manual override" in the sense this rule protects - there is no prior AUTO cycle for it
 *       to be overriding, so it is eligible for its very first auto-fetch immediately rather than
 *       waiting out a day it was never actually edited on.
 *   <li>A currency the provider doesn't quote (code missing from the fetched map) is left
 *       unchanged - stale rates are better than zeroes/nulls.
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class CurrencyRateApplier {

    private static final String BASE_CURRENCY_CODE = "MYR";
    private static final String RATE_SOURCE_AUTO = "AUTO";
    private static final String RATE_SOURCE_MANUAL = "MANUAL";
    private static final ZoneId FX_ZONE = ZoneId.of("Asia/Kuala_Lumpur");

    private final CurrencyRepository currencyRepository;

    @Transactional
    public int apply(Map<String, BigDecimal> fetchedRates) {
        LocalDate today = LocalDate.now(FX_ZONE);
        List<Currency> currencies = currencyRepository.findByDeletedFalseOrderByCodeAsc();

        int updated = 0;
        for (Currency currency : currencies) {
            if (BASE_CURRENCY_CODE.equalsIgnoreCase(currency.getCode())) {
                continue;
            }
            if (isManualOverrideStillInGracePeriod(currency, today)) {
                continue;
            }
            BigDecimal rate = fetchedRates.get(currency.getCode().toUpperCase());
            if (rate == null) {
                continue;
            }
            currency.setRate(rate);
            currency.setRateSource(RATE_SOURCE_AUTO);
            currency.setRateFetchedAt(LocalDateTime.now());
            currencyRepository.save(currency);
            updated++;
        }
        return updated;
    }

    private boolean isManualOverrideStillInGracePeriod(Currency currency, LocalDate today) {
        return RATE_SOURCE_MANUAL.equals(currency.getRateSource())
                && currency.getRateFetchedAt() != null
                && currency.getUpdatedAt() != null
                && !currency.getUpdatedAt().toLocalDate().isBefore(today);
    }
}
