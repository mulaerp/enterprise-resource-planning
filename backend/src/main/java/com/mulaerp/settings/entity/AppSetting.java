package com.mulaerp.settings.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Runtime-editable key/value settings store (V44) - primarily commercial terms a BRANCH MANAGER
 * (RoleRules.MANAGER_UP) can change without an application.yml edit + redeploy (see
 * {@code com.mulaerp.settings.service.SettingsService}). Extends BaseEntity, so every UPDATE is
 * captured automatically by the site-wide audit listener (old-&gt;new on {@link #value}) with no
 * extra wiring - verified live during the WARRANTY-TIERS gate.
 */
@Entity
@Table(name = "app_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AppSetting extends BaseEntity {

    @Column(name = "setting_key", nullable = false, unique = true, length = 100)
    private String settingKey;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String value;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", nullable = false, length = 20)
    private ValueType valueType;

    @Column(columnDefinition = "TEXT")
    private String description;

    public enum ValueType {
        STRING,
        INT,
        DECIMAL,
        BOOLEAN
    }
}
