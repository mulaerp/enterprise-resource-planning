package com.mulaerp.currency.exception;

import java.util.List;

/**
 * Thrown by {@code FxRateProviderClient#fetchRates()} when every configured provider (primary +
 * fallback) failed or returned no usable rates. Mapped to a 502-style problem-JSON response by
 * {@code CurrencyController}'s local {@code @ExceptionHandler} (not
 * {@code GlobalExceptionHandler} - kept local to the currency module, which owns this exception).
 * Never allowed to propagate out of the scheduled refresher - see
 * {@code FxRateRefreshScheduler#refresh}, which catches and logs it so stale rates are retained
 * rather than the app failing.
 */
public class FxProviderException extends RuntimeException {

    private final List<String> providersAttempted;

    public FxProviderException(String message, List<String> providersAttempted) {
        super(message);
        this.providersAttempted = providersAttempted;
    }

    public List<String> getProvidersAttempted() {
        return providersAttempted;
    }
}
