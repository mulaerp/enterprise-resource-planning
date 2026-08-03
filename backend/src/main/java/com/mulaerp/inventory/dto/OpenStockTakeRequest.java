package com.mulaerp.inventory.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OpenStockTakeRequest {

    @NotNull(message = "Warehouse is required")
    private UUID warehouseId;

    private String notes;
}
