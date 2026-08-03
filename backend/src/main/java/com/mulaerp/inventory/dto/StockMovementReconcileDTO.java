package com.mulaerp.inventory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * WP7: response for GET /api/v1/inventory/movements/reconcile/{productId}.
 * <p>
 * The ledger was introduced mid-life (V22) - most products already carried stock before their
 * first ledger row was ever written, so ledgerSum alone never explains currentStock. baselineOffset
 * is derived from the earliest movement on record: quantityAfter - quantityDelta on that row is
 * exactly the stock level the product was at immediately before the ledger started tracking it.
 * When that's derivable, consistent = (baselineOffset + ledgerSum == currentStock).
 * <p>
 * When there is no movement at all yet (nothing to derive a baseline from), baselineOffset is
 * null and consistent is null - not false. Reporting "false" would falsely imply a detected
 * discrepancy; there simply isn't enough ledger history yet to make the claim either way.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockMovementReconcileDTO {
    private UUID productId;
    private Integer currentStock;
    private Integer ledgerSum;
    private Integer baselineOffset;
    private Boolean consistent;
    private String note;
}
