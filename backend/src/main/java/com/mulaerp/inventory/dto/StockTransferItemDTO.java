package com.mulaerp.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockTransferItemDTO {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private UUID batchId;
    private String batchNumber;
    private Integer quantity;
}
