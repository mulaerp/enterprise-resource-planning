package com.mulaerp.settings.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.settings.dto.AppSettingDto;
import com.mulaerp.settings.entity.AppSetting;
import com.mulaerp.settings.repository.AppSettingRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Runtime-editable commercial settings (V44, {@code app_settings}) - typed getters with a small
 * in-memory cache (never reads the DB on every warranty issue - see WarrantyService) and safe
 * fallbacks to a compile-time default whenever a key is missing or malformed. A bad/corrupted
 * setting row must NEVER fail the business operation reading it (e.g. a PoS sale) - every getter
 * below logs a warning and returns the caller-supplied default instead of throwing.
 *
 * <p>Cache shape: a single immutable {@code Map} snapshot, swapped atomically on every write (see
 * {@link #refreshCache()}) - simplest correct approach for a table with a handful of rows read far
 * more often than written. {@link #updateSetting} is the only write path and always refreshes the
 * whole snapshot after saving, so a change is visible to the very next read with no restart and no
 * per-request DB round trip.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SettingsService {

    /** OWNER DECISION defaults - used only when the DB row is missing or unparseable, never
     * read from application.yml (these settings deliberately do not live there - see the
     * repair-warranty skill / task spec: editable at runtime by the branch manager, not by
     * editing application.yml). */
    private static final int DEFAULT_GUEST_BASE_DAYS = 3;
    private static final int DEFAULT_MEMBER_BASE_DAYS = 10;

    public static final String WARRANTY_GUEST_BASE_DAYS = "warranty.guest-base-days";
    public static final String WARRANTY_MEMBER_BASE_DAYS = "warranty.member-base-days";

    private final AppSettingRepository appSettingRepository;

    private volatile Map<String, AppSetting> cache = Collections.emptyMap();

    @PostConstruct
    void init() {
        refreshCache();
    }

    @Transactional(readOnly = true)
    public List<AppSettingDto> getAllSettings() {
        return appSettingRepository.findAllByDeletedFalseOrderBySettingKeyAsc().stream()
                .map(AppSettingDto::fromEntity)
                .collect(Collectors.toList());
    }

    /** Convenience typed getter - see #getGuestBaseDays/#getMemberBaseDays for the two warranty
     * keys the WARRANTY-TIERS task seeds. */
    public int getInt(String key, int defaultValue) {
        AppSetting setting = cache.get(key);
        if (setting == null) {
            log.warn("Setting '{}' not found - using default {}", key, defaultValue);
            return defaultValue;
        }
        try {
            return Integer.parseInt(setting.getValue().trim());
        } catch (NumberFormatException e) {
            log.warn("Setting '{}' has a malformed INT value '{}' - using default {}", key, setting.getValue(), defaultValue);
            return defaultValue;
        }
    }

    public BigDecimal getDecimal(String key, BigDecimal defaultValue) {
        AppSetting setting = cache.get(key);
        if (setting == null) {
            log.warn("Setting '{}' not found - using default {}", key, defaultValue);
            return defaultValue;
        }
        try {
            return new BigDecimal(setting.getValue().trim());
        } catch (NumberFormatException e) {
            log.warn("Setting '{}' has a malformed DECIMAL value '{}' - using default {}", key, setting.getValue(), defaultValue);
            return defaultValue;
        }
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        AppSetting setting = cache.get(key);
        if (setting == null) {
            log.warn("Setting '{}' not found - using default {}", key, defaultValue);
            return defaultValue;
        }
        String raw = setting.getValue().trim();
        if ("true".equalsIgnoreCase(raw)) {
            return true;
        }
        if ("false".equalsIgnoreCase(raw)) {
            return false;
        }
        log.warn("Setting '{}' has a malformed BOOLEAN value '{}' - using default {}", key, raw, defaultValue);
        return defaultValue;
    }

    public String getString(String key, String defaultValue) {
        AppSetting setting = cache.get(key);
        if (setting == null || setting.getValue() == null || setting.getValue().isBlank()) {
            return defaultValue;
        }
        return setting.getValue();
    }

    /** OWNER DECISION: guest (non-member) base warranty, in days - see WarrantyService#resolveDuration. */
    public int getGuestBaseDays() {
        return getInt(WARRANTY_GUEST_BASE_DAYS, DEFAULT_GUEST_BASE_DAYS);
    }

    /** OWNER DECISION: loyalty-member base warranty, in days - see WarrantyService#resolveDuration. */
    public int getMemberBaseDays() {
        return getInt(WARRANTY_MEMBER_BASE_DAYS, DEFAULT_MEMBER_BASE_DAYS);
    }

    /**
     * Validates {@code rawValue} against the setting's declared {@link AppSetting.ValueType}
     * (400 via IllegalArgumentException on anything unparseable, or negative for a numeric type -
     * every seeded key today is a day-count/percentage-shaped INT/DECIMAL, so "must be
     * non-negative" is a safe blanket rule rather than a per-key allowlist), persists the change
     * (audited automatically - AppSetting extends BaseEntity), and refreshes the cache so the very
     * next read sees it with no restart required.
     */
    @Transactional
    public AppSettingDto updateSetting(String key, String rawValue) {
        AppSetting setting = appSettingRepository.findBySettingKeyAndDeletedFalse(key)
                .orElseThrow(() -> new ResourceNotFoundException("Setting not found: " + key));

        String trimmed = rawValue == null ? null : rawValue.trim();
        if (trimmed == null || trimmed.isEmpty()) {
            throw new IllegalArgumentException("value must not be blank");
        }

        switch (setting.getValueType()) {
            case INT -> {
                int parsed;
                try {
                    parsed = Integer.parseInt(trimmed);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("value for '" + key + "' must be a whole number");
                }
                if (parsed < 0) {
                    throw new IllegalArgumentException("value for '" + key + "' must be a non-negative integer");
                }
            }
            case DECIMAL -> {
                BigDecimal parsed;
                try {
                    parsed = new BigDecimal(trimmed);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("value for '" + key + "' must be a decimal number");
                }
                if (parsed.compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("value for '" + key + "' must be a non-negative decimal");
                }
            }
            case BOOLEAN -> {
                if (!"true".equalsIgnoreCase(trimmed) && !"false".equalsIgnoreCase(trimmed)) {
                    throw new IllegalArgumentException("value for '" + key + "' must be 'true' or 'false'");
                }
            }
            case STRING -> {
                // Any non-blank string is acceptable - already checked above.
            }
        }

        setting.setValue(trimmed);
        AppSetting saved = appSettingRepository.save(setting);
        refreshCache();
        return AppSettingDto.fromEntity(saved);
    }

    private void refreshCache() {
        Map<String, AppSetting> fresh = new HashMap<>();
        for (AppSetting setting : appSettingRepository.findAllByDeletedFalseOrderBySettingKeyAsc()) {
            fresh.put(setting.getSettingKey(), setting);
        }
        this.cache = Collections.unmodifiableMap(fresh);
    }
}
