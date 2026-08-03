package com.mulaerp.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WP8 (e): warehouse creation, a stock transfer's full PENDING -> IN_TRANSIT -> COMPLETED
 * lifecycle (which is the only place stock actually moves between warehouses -
 * StockTransferService#completeTransfer), the over-transfer rejection (400, not a silently
 * negative warehouse balance), the append-only stock movement ledger recording every mutation,
 * and the ledger-vs-stock reconciliation endpoint.
 */
class InventoryFlowIT extends BaseIntegrationTest {

    @Test
    void warehouseTransferMovesStockAndIsLedgeredAndReconciles() {
        String suffix = uniqueSuffix();

        UUID mainWarehouseId = findWarehouseIdByCode("MAIN");

        ResponseEntity<JsonNode> secondaryWarehouseResp = post("/warehouses", body(
                "code", "WH-" + suffix,
                "name", "Inventory Flow Warehouse " + suffix,
                "location", "Test Location",
                "active", true
        ));
        assertThat(secondaryWarehouseResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID secondaryWarehouseId = UUID.fromString(secondaryWarehouseResp.getBody().get("id").asText());

        ResponseEntity<JsonNode> productResp = post("/products", body(
                "sku", "SKU-INV-" + suffix,
                "name", "Inventory Flow Product " + suffix,
                "unitPrice", 25.00,
                "costPrice", 10.00,
                "stockQuantity", 0,
                "reorderLevel", 5,
                "status", "ACTIVE"
        ));
        assertThat(productResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = UUID.fromString(productResp.getBody().get("id").asText());

        // ---- Seed 30 units into MAIN via a stock adjustment (also the first ledger row) ------
        ResponseEntity<JsonNode> adjustmentResp = createStockAdjustment(body(
                "productId", productId.toString(),
                "adjustmentType", "INCREASE",
                "quantityAdjusted", 30,
                "reason", "Seed stock for InventoryFlowIT",
                "adjustmentDate", LocalDate.now().toString()
        ));
        assertThat(adjustmentResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // ---- Transfer 10 units MAIN -> secondary ----------------------------------------------
        ResponseEntity<JsonNode> transferResp = post("/stock-transfers", body(
                "fromWarehouseId", mainWarehouseId.toString(),
                "toWarehouseId", secondaryWarehouseId.toString(),
                "transferDate", LocalDate.now().toString(),
                "items", List.of(body(
                        "productId", productId.toString(),
                        "quantity", 10
                ))
        ));
        assertThat(transferResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID transferId = UUID.fromString(transferResp.getBody().get("id").asText());

        ResponseEntity<JsonNode> markInTransit = patch("/stock-transfers/" + transferId + "/status?status=IN_TRANSIT");
        assertThat(markInTransit.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<JsonNode> completeResp = post("/stock-transfers/" + transferId + "/complete", null);
        assertThat(completeResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        // ---- Product.stockQuantity is the cross-warehouse TOTAL and is unaffected by a
        // transfer; only the per-warehouse warehouse_stock breakdown moves. ---------------------
        assertThat(get("/products/" + productId).getBody().get("stockQuantity").asInt()).isEqualTo(30);
        assertThat(stockQuantityAt(mainWarehouseId, productId)).isEqualTo(20);
        assertThat(stockQuantityAt(secondaryWarehouseId, productId)).isEqualTo(10);

        // ---- Movement ledger: adjustment + transfer-out + transfer-in, newest first -----------
        ResponseEntity<JsonNode> movementsResp = get("/inventory/movements?productId=" + productId + "&size=20");
        assertThat(movementsResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode movements = movementsResp.getBody().get("content");
        assertThat(movements).hasSize(3);

        boolean sawAdjustment = false, sawTransferOut = false, sawTransferIn = false;
        for (JsonNode movement : movements) {
            String type = movement.get("movementType").asText();
            int delta = movement.get("quantityDelta").asInt();
            switch (type) {
                case "ADJUSTMENT" -> {
                    assertThat(delta).isEqualTo(30);
                    sawAdjustment = true;
                }
                case "TRANSFER_OUT" -> {
                    assertThat(delta).isEqualTo(-10);
                    assertThat(movement.get("warehouseId").asText()).isEqualTo(mainWarehouseId.toString());
                    sawTransferOut = true;
                }
                case "TRANSFER_IN" -> {
                    assertThat(delta).isEqualTo(10);
                    assertThat(movement.get("warehouseId").asText()).isEqualTo(secondaryWarehouseId.toString());
                    sawTransferIn = true;
                }
                default -> throw new AssertionError("Unexpected movement type: " + type);
            }
        }
        assertThat(sawAdjustment).as("adjustment ledger row present").isTrue();
        assertThat(sawTransferOut).as("transfer-out ledger row present").isTrue();
        assertThat(sawTransferIn).as("transfer-in ledger row present").isTrue();

        // ---- Reconciliation: ledgerSum (30 - 10 + 10 = 30) must match currentStock (30) -------
        ResponseEntity<JsonNode> reconcileResp = get("/inventory/movements/reconcile/" + productId);
        assertThat(reconcileResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode reconcile = reconcileResp.getBody();
        assertThat(reconcile.get("currentStock").asInt()).isEqualTo(30);
        assertThat(reconcile.get("ledgerSum").asInt()).isEqualTo(30);
        assertThat(reconcile.get("consistent").asBoolean()).isTrue();
    }

    @Test
    void overTransferIsRejectedWith400() {
        String suffix = uniqueSuffix();
        UUID mainWarehouseId = findWarehouseIdByCode("MAIN");

        ResponseEntity<JsonNode> secondaryWarehouseResp = post("/warehouses", body(
                "code", "WHOVER-" + suffix,
                "name", "Over Transfer Warehouse " + suffix,
                "active", true
        ));
        assertThat(secondaryWarehouseResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID secondaryWarehouseId = UUID.fromString(secondaryWarehouseResp.getBody().get("id").asText());

        ResponseEntity<JsonNode> productResp = post("/products", body(
                "sku", "SKU-OVER-" + suffix,
                "name", "Over Transfer Product " + suffix,
                "unitPrice", 25.00,
                "costPrice", 10.00,
                "stockQuantity", 0,
                "reorderLevel", 5,
                "status", "ACTIVE"
        ));
        assertThat(productResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = UUID.fromString(productResp.getBody().get("id").asText());

        // Deliberately no stock adjustment: MAIN's warehouse_stock row for this product is either
        // absent or zero, so any positive-quantity transfer out of MAIN must be rejected.
        ResponseEntity<JsonNode> transferResp = post("/stock-transfers", body(
                "fromWarehouseId", mainWarehouseId.toString(),
                "toWarehouseId", secondaryWarehouseId.toString(),
                "transferDate", LocalDate.now().toString(),
                "items", List.of(body(
                        "productId", productId.toString(),
                        "quantity", 999
                ))
        ));
        assertThat(transferResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID transferId = UUID.fromString(transferResp.getBody().get("id").asText());

        ResponseEntity<JsonNode> markInTransit = patch("/stock-transfers/" + transferId + "/status?status=IN_TRANSIT");
        assertThat(markInTransit.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<JsonNode> completeResp = post("/stock-transfers/" + transferId + "/complete", null);
        assertThat(completeResp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // The rejected transfer must not have moved anything.
        assertThat(get("/products/" + productId).getBody().get("stockQuantity").asInt()).isEqualTo(0);
    }

    private UUID findWarehouseIdByCode(String code) {
        ResponseEntity<JsonNode> response = get("/warehouses?search=" + code + "&size=50");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        for (JsonNode warehouse : response.getBody().get("content")) {
            if (code.equals(warehouse.get("code").asText())) {
                return UUID.fromString(warehouse.get("id").asText());
            }
        }
        throw new AssertionError("Warehouse with code " + code + " not found - check V16 migration");
    }

    private int stockQuantityAt(UUID warehouseId, UUID productId) {
        ResponseEntity<JsonNode> response = get("/warehouses/" + warehouseId + "/stock");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        for (JsonNode stock : response.getBody()) {
            if (productId.toString().equals(stock.get("productId").asText())) {
                return stock.get("quantity").asInt();
            }
        }
        throw new AssertionError("No warehouse_stock row for product " + productId + " in warehouse " + warehouseId);
    }
}
