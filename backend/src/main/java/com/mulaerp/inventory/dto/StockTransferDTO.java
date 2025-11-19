package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.StockTransfer;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockTransferDTO {
    private UUID id;
    private String transferNumber;
    private UUID fromWarehouseId;
    private String fromWarehouseName;
    private UUID toWarehouseId;
    private String toWarehouseName;
    private LocalDate transferDate;
    private StockTransfer.TransferStatus status;
    private String notes;
    private List<StockTransferItemDTO> items = new ArrayList<>();
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
