package com.mulaerp.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateSalesOrderRequest {

    @NotNull(message = "Customer ID is required")
    private UUID customerId;

    @NotNull(message = "Order date is required")
    private LocalDate orderDate;

    private LocalDate deliveryDate;

    private BigDecimal tax;

    private String notes;

    @NotEmpty(message = "Order must have at least one item")
    @Valid
    private List<CreateSalesOrderItemRequest> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateSalesOrderItemRequest {
        @NotNull(message = "Product ID is required")
        private UUID productId;

        @NotNull(message = "Quantity is required")
        private Integer quantity;

        @NotNull(message = "Unit price is required")
        private BigDecimal unitPrice;

        private BigDecimal discount;
        private BigDecimal taxRate;

        // --- WP3: optional batch/serial tracking -----------------------------------------
        // Both optional; omitting them keeps the line exactly as it worked before WP3.

        /** Batch to fulfil this line from - validated against the product, decremented on delivery. */
        private UUID batchId;

        /** Specific serial numbers to sell on this line - validated as IN_STOCK for the product. */
        private List<UUID> serialIds;
    }
}
