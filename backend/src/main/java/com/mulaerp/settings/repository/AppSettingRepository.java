package com.mulaerp.settings.repository;

import com.mulaerp.settings.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppSettingRepository extends JpaRepository<AppSetting, UUID> {

    List<AppSetting> findAllByDeletedFalseOrderBySettingKeyAsc();

    Optional<AppSetting> findBySettingKeyAndDeletedFalse(String settingKey);
}
