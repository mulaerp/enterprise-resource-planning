package com.mulaerp.currency.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One row per FX rate refresh ATTEMPT (scheduled or manual-trigger via
 * {@code POST /api/v1/currencies/refresh-rates}), success or failure - see V31 migration and
 * {@code com.mulaerp.currency.service.FxRateRefreshService}. Exists so a provider outage is
 * visible via {@code GET /api/v1/currencies/fetch-log} rather than only in application logs -
 * "failures are visible rather than silent".
 */
@Entity
@Table(name = "fx_rate_fetch_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FxRateFetchLog extends BaseEntity {

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    /** Provider URL(s) used (success: the one that answered; failure: all attempted, comma-joined). */
    @Column(length = 255)
    private String provider;

    /** {@code SUCCESS} or {@code FAILED}. */
    @Column(nullable = false, length = 20)
    private String status;

    /** Human-readable detail - null on success, the failure reason (all providers' errors) on failure. */
    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "rates_updated", nullable = false)
    private Integer ratesUpdated;
}
