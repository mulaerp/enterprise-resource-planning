package com.mulaerp.currency.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A currency the storefront can display prices in. `rate` is the MYR -> this-currency
 * conversion factor: price_in_currency = price_in_MYR * rate. The MYR row itself carries
 * rate = 1.0 (it is the base currency) and CurrencyService#updateRate refuses to change it away
 * from that. See V25 migration for the seed data and rate-direction rationale.
 *
 * <p>V31 (automatic FX rates): {@code rateSource} distinguishes an operator's manual
 * {@code PUT /api/v1/currencies/{code}} from an automatic provider fetch (scheduled or manual
 * trigger - see {@code com.mulaerp.currency.service.FxRateRefreshService}); {@code rateFetchedAt}
 * records when an AUTO fetch last set this row's rate (null if it has never been auto-fetched).
 * Precedence: a manual PUT is never silently overwritten by the same day's AUTO refresh, UNLESS
 * {@code rateFetchedAt} is still null (i.e. this currency has never actually been under AUTO
 * management, so there is nothing to "protect" it from yet) - see
 * {@code CurrencyService#updateRate} and {@code CurrencyRateApplier} javadoc for the full rule.
 */
@Entity
@Table(name = "currencies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Currency extends BaseEntity {

    /** ISO 4217-style code, e.g. "MYR", "USD". Stored uppercase. */
    @Column(nullable = false, unique = true, length = 3)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 10)
    private String symbol;

    @Column(nullable = false, precision = 15, scale = 6)
    private BigDecimal rate;

    /** {@code MANUAL} (operator PUT) or {@code AUTO} (scheduled/manual-trigger provider fetch). */
    @Column(name = "rate_source", nullable = false, length = 20)
    private String rateSource = "MANUAL";

    /** When an AUTO fetch last set this row's rate; null if never auto-fetched. */
    @Column(name = "rate_fetched_at")
    private LocalDateTime rateFetchedAt;
}
