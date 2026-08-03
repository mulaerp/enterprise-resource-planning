package com.mulaerp.currency.controller;

import com.mulaerp.currency.dto.CurrencyDto;
import com.mulaerp.currency.dto.FxErrorResponse;
import com.mulaerp.currency.dto.FxRateFetchLogDto;
import com.mulaerp.currency.dto.RefreshRatesResponse;
import com.mulaerp.currency.dto.UpdateCurrencyRateRequest;
import com.mulaerp.currency.exception.FxProviderException;
import com.mulaerp.currency.service.CurrencyService;
import com.mulaerp.currency.service.FxRateFetchLogService;
import com.mulaerp.currency.service.FxRateRefreshService;
import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.util.PageSizeCap;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Staff endpoints - list is any authenticated user, rate updates / manual refresh trigger /
 * fetch-log read are MANAGER+ (RoleRules.MANAGER_UP - same tier as currency rate updates
 * generally, see RoleRules javadoc).
 */
@RestController
@RequestMapping("/api/v1/currencies")
@RequiredArgsConstructor
public class CurrencyController {

    private final CurrencyService currencyService;
    private final FxRateRefreshService fxRateRefreshService;
    private final FxRateFetchLogService fxRateFetchLogService;

    @GetMapping
    public ResponseEntity<List<CurrencyDto>> getAllCurrencies() {
        return ResponseEntity.ok(currencyService.getAllCurrencies());
    }

    @PutMapping("/{code}")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<CurrencyDto> updateRate(
            @PathVariable String code,
            @Valid @RequestBody UpdateCurrencyRateRequest request
    ) {
        return ResponseEntity.ok(currencyService.updateRate(code, request.getRate()));
    }

    /** Manual trigger for the same refresh the scheduler runs automatically - see FxRateRefreshService. */
    @PostMapping("/refresh-rates")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<RefreshRatesResponse> refreshRates() {
        return ResponseEntity.ok(fxRateRefreshService.refreshRates());
    }

    @GetMapping("/fetch-log")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<Page<FxRateFetchLogDto>> getFetchLog(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("fetchedAt").descending());
        return ResponseEntity.ok(fxRateFetchLogService.getFetchLog(pageable));
    }

    /**
     * Local handler (deliberately not added to the shared GlobalExceptionHandler - this exception
     * type is owned by, and only ever thrown from within, this module) for when every configured
     * FX provider fails: 502 Bad Gateway, since the failure is genuinely upstream/external, not a
     * client error (400) or a resource-not-found (404).
     */
    @ExceptionHandler(FxProviderException.class)
    public ResponseEntity<FxErrorResponse> handleFxProviderFailure(FxProviderException ex, HttpServletRequest request) {
        FxErrorResponse error = new FxErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_GATEWAY.value(),
                HttpStatus.BAD_GATEWAY.getReasonPhrase(),
                "Unable to fetch exchange rates from any configured provider: " + ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error);
    }
}
