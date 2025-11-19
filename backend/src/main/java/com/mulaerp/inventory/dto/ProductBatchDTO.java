package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.ProductBatch;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductBatchDTO {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private String batchNumber;
    private LocalDate manufactureDate;
    private LocalDate expiryDate;
    private Integer quantity;
    private ProductBatch.BatchStatus status;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
