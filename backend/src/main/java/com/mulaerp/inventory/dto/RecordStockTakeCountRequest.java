package com.mulaerp.inventory.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecordStockTakeCountRequest {

    @NotNull(message = "Counted quantity is required")
    private Integer countedQuantity;

    private String note;
}
