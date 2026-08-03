package com.mulaerp.shop.order.scheduler;

import com.mulaerp.shop.order.service.ShopOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic release of expired, unpaid/uncollected stock reservations (owner decision 2). Default
 * schedule is every 15 minutes - frequent enough that a released unit reappears for sale promptly,
 * infrequent enough not to be a meaningful DB load. Same "never let an exception escape" pattern
 * as {@code FxRateRefreshScheduler} - a failed run must never crash the scheduler thread or the
 * application; it just tries again next tick.
 */
@Component
@ConditionalOnProperty(prefix = "mulaerp.shop.order", name = "reservation-release-enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class ShopOrderReservationScheduler {

    private final ShopOrderService shopOrderService;

    @Scheduled(cron = "${mulaerp.shop.order.reservation-release-cron:0 */15 * * * *}")
    public void releaseExpiredReservations() {
        try {
            int released = shopOrderService.releaseExpiredReservations();
            if (released > 0) {
                log.info("Released {} expired shop order reservation(s)", released);
            }
        } catch (Exception e) {
            log.warn("Scheduled shop order reservation release failed: {}", e.getMessage());
        }
    }
}
