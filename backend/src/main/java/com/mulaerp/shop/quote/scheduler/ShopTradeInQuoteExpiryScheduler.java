package com.mulaerp.shop.quote.scheduler;

import com.mulaerp.shop.quote.entity.ShopTradeInQuote;
import com.mulaerp.shop.quote.repository.ShopTradeInQuoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Task item 4: sweeps QUOTED postal/drop-off trade-in quotes past their {@code expiresAt} and
 * flips them to EXPIRED. Only QUOTED rows are ever touched - a quote already RECEIVED/OFFER_MADE/
 * etc. by the time it would have expired is left alone (staff already acted on it; the expiry
 * clock only matters before that happens).
 *
 * <p><b>Rule this enforces (documented per task item 4):</b> once EXPIRED, a quote cannot be
 * received or inspected - {@code ShopTradeInQuoteService#receive}/{@code #inspect} both reject any
 * status other than the one they expect (409), which already covers this since EXPIRED is never
 * QUOTED. There is no dedicated staff "re-quote" endpoint in this task's scope; the customer
 * simply submits a brand-new {@code POST /api/v1/shop/quotes} request, which prices and dates a
 * fresh quote from scratch. (The guest path, {@code POST /api/v1/public/shop/quotes}, no longer
 * exists at all - see {@code ShopTradeInQuote}'s class javadoc "Members-only".)
 *
 * <p>Default cron: every 15 minutes - frequent enough that a quote's expiry is enforced promptly
 * without needing a bespoke trigger, configurable via {@code mulaerp.shop.quote.expiry-schedule-cron}.
 * Follows the same "never let an exception escape" pattern as {@code FxRateRefreshScheduler}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ShopTradeInQuoteExpiryScheduler {

    private final ShopTradeInQuoteRepository quoteRepository;

    @Scheduled(cron = "${mulaerp.shop.quote.expiry-schedule-cron:0 */15 * * * *}")
    @Transactional
    public void expireOverdueQuotes() {
        try {
            List<ShopTradeInQuote> overdue = quoteRepository.findByStatusAndExpiresAtBeforeAndDeletedFalse(
                    ShopTradeInQuote.Status.QUOTED.name(), LocalDateTime.now());
            if (overdue.isEmpty()) {
                return;
            }
            for (ShopTradeInQuote quote : overdue) {
                quote.setStatus(ShopTradeInQuote.Status.EXPIRED.name());
            }
            quoteRepository.saveAll(overdue);
            log.info("Expired {} postal/drop-off trade-in quote(s) past their valid-days window", overdue.size());
        } catch (Exception e) {
            // NEVER rethrow - same backstop as FxRateRefreshScheduler. A failed sweep just means
            // stale QUOTED rows are retried on the next tick.
            log.warn("Scheduled trade-in quote expiry sweep failed: {}", e.getMessage());
        }
    }
}
