package com.mulaerp.currency.service;

import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.currency.dto.RefreshRatesResponse;
import com.mulaerp.currency.entity.FxRateFetchLog;
import com.mulaerp.currency.exception.FxProviderException;
import com.mulaerp.currency.repository.FxRateFetchLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Orchestrates one FX rate refresh: fetch from a provider (with fallback, see
 * {@link FxRateProviderClient}), apply the result to the {@code currencies} table (see
 * {@link CurrencyRateApplier}), and always leave a {@code fx_rate_fetch_log} row behind - on
 * success AND on failure - so a provider outage is visible rather than silent.
 *
 * <p>Deliberately NOT {@code @Transactional} at this level: the provider fetch is a network call
 * and must not hold a DB connection/transaction open for its duration. The fetch-log write goes
 * through {@link NonBlockingHookExecutor#runInNewTransaction} (REQUIRES_NEW) - the same pattern
 * this codebase already uses for journal/email/warranty side-effect hooks - so the log row
 * commits independently and survives even when this method goes on to rethrow
 * {@link FxProviderException} to its caller.
 *
 * <p>Callers: {@code CurrencyController#refreshRates} (manual trigger, lets the exception
 * propagate to a 502) and {@code FxRateRefreshScheduler#refresh} (scheduled - MUST catch and log,
 * never rethrow, so a failed refresh never affects anything else and stale rates are retained).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FxRateRefreshService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";

    private final FxRateProviderClient providerClient;
    private final CurrencyRateApplier rateApplier;
    private final FxRateFetchLogRepository fetchLogRepository;
    private final NonBlockingHookExecutor hookExecutor;

    public RefreshRatesResponse refreshRates() {
        FxRateProviderClient.FetchResult fetch;
        try {
            fetch = providerClient.fetchRates();
        } catch (FxProviderException ex) {
            log.warn("FX rate refresh failed - all providers exhausted: {}", ex.getMessage());
            writeLog(STATUS_FAILED, String.join(",", ex.getProvidersAttempted()), ex.getMessage(), 0);
            throw ex;
        }

        int updated = rateApplier.apply(fetch.rates());
        LocalDateTime fetchedAt = LocalDateTime.now();
        writeLog(STATUS_SUCCESS, fetch.provider(), null, updated);
        return new RefreshRatesResponse(updated, fetch.provider(), fetchedAt);
    }

    private void writeLog(String status, String provider, String message, int updated) {
        hookExecutor.runInNewTransaction(() -> {
            FxRateFetchLog row = new FxRateFetchLog();
            row.setFetchedAt(LocalDateTime.now());
            row.setProvider(provider);
            row.setStatus(status);
            row.setMessage(message);
            row.setRatesUpdated(updated);
            fetchLogRepository.save(row);
        });
    }
}
