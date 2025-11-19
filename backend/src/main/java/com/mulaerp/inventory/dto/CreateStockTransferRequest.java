package com.mulaerp.inventory.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStockTransferRequest {

    @NotNull(message = "From warehouse is required")
    private UUID fromWarehouseId;

    @NotNull(message = "To warehouse is required")
    private UUID toWarehouseId;

    @NotNull(message = "Transfer date is required")
    private LocalDate transferDate;

    private String notes;

    @NotEmpty(message = "At least one item is required")
    private List<TransferItemRequest> items = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TransferItemRequest {
        @NotNull(message = "Product ID is required")
        private UUID productId;

        private UUID batchId;

        @NotNull(message = "Quantity is required")
        private Integer quantity;
    }
}
