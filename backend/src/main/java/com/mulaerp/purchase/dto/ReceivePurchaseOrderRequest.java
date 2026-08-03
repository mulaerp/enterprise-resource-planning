package com.mulaerp.purchase.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Optional body for {@code PATCH /purchase-orders/{id}/status?status=RECEIVED} (WP3).
 * Entirely optional - a plain status update with no body (or one that omits an item)
 * receives stock exactly as before, with no batch/serial created.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReceivePurchaseOrderRequest {

    private List<ItemTracking> items;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemTracking {

        /** PurchaseOrderItem id this tracking info applies to. */
        private UUID itemId;

        /** When set, a new ProductBatch is created for the received quantity and attached to the line. */
        private String batchNumber;

        private LocalDate manufactureDate;

        private LocalDate expiryDate;

        /** When set, one ProductSerial is registered per entry (must not exceed the received quantity). */
        private List<String> serialNumbers;
    }
}
