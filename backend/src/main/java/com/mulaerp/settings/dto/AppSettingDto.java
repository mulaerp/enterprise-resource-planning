package com.mulaerp.settings.dto;

import com.mulaerp.settings.entity.AppSetting;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AppSettingDto {
    private UUID id;
    private String key;
    private String value;
    private AppSetting.ValueType valueType;
    private String description;
    private String updatedBy;
    private LocalDateTime updatedAt;

    public static AppSettingDto fromEntity(AppSetting s) {
        return new AppSettingDto(
                s.getId(),
                s.getSettingKey(),
                s.getValue(),
                s.getValueType(),
                s.getDescription(),
                s.getUpdatedBy(),
                s.getUpdatedAt()
        );
    }
}
