package com.mulaerp.settings.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.settings.dto.AppSettingDto;
import com.mulaerp.settings.dto.UpdateSettingRequest;
import com.mulaerp.settings.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Runtime-editable commercial settings (V44) - BRANCH MANAGER territory (RoleRules.MANAGER_UP),
 * deliberately separate from Company Settings (ADMIN-only, com.mulaerp.company) per the owner
 * decision: commercial terms belong to the manager, ADMIN is IT.
 */
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
@PreAuthorize(RoleRules.MANAGER_UP)
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping
    public ResponseEntity<List<AppSettingDto>> getAllSettings() {
        return ResponseEntity.ok(settingsService.getAllSettings());
    }

    @PutMapping("/{key}")
    public ResponseEntity<AppSettingDto> updateSetting(
            @PathVariable String key,
            @Valid @RequestBody UpdateSettingRequest request
    ) {
        return ResponseEntity.ok(settingsService.updateSetting(key, request.getValue()));
    }
}
