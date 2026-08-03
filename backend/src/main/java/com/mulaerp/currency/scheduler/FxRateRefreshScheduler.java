package com.mulaerp.currency.scheduler;

import com.mulaerp.currency.dto.RefreshRatesResponse;
import com.mulaerp.currency.service.FxRateRefreshService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily automatic FX rate refresh. Entirely disabled (bean not even created) when
 * {@code mulaerp.fx.enabled=false} - see {@code application-test.yml}, which sets this so the
 * integration suite never makes a real network call. Default schedule is 06:00 Asia/Kuala_Lumpur,
 * overridable via {@code mulaerp.fx.schedule-cron}.
 *
 * <p>CRITICAL: must never let an exception escape {@link #refresh()}. A failed fetch (all
 * providers down) is already logged as a FAILED row by {@link FxRateRefreshService} itself; this
 * try/catch is the backstop that stops that failure from doing anything worse than "stale rates
 * are retained until the next successful refresh" - the whole point of the design (see class
 * javadoc on {@code FxRateRefreshService}).
 */
@Component
@ConditionalOnProperty(prefix = "mulaerp.fx", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class FxRateRefreshScheduler {

    private final FxRateRefreshService refreshService;

    @Scheduled(cron = "${mulaerp.fx.schedule-cron:0 0 6 * * *}", zone = "Asia/Kuala_Lumpur")
    public void refresh() {
        try {
            RefreshRatesResponse result = refreshService.refreshRates();
            log.info("Scheduled FX rate refresh succeeded: provider={}, updated={}",
                    result.getProvider(), result.getUpdated());
        } catch (Exception ex) {
            // NEVER rethrow - a failed refresh must never surface as an application error. The
            // FAILED fetch-log row was already written inside refreshRates() itself; this is just
            // the log line + the guarantee that stale rates are retained.
            log.warn("Scheduled FX rate refresh failed, stale rates retained: {}", ex.getMessage());
        }
    }
}
