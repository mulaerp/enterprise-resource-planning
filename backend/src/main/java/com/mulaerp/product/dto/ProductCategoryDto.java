package com.mulaerp.product.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductCategoryDto {
    private UUID id;
    private String name;
    private UUID parentId;
    private String parentName;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
