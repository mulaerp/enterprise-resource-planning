---
name: inventory
description: Mula ERP inventory — warehouses, stock model, batch/serial tracking, and the stock movement ledger. Use for inventory, warehouse, stock, transfer, batch, serial, movements, ledger.
---

# Inventory

Backend: `com.mulaerp.inventory` (adjustments, batches, serials, movements, transfers), `com.mulaerp.warehouse`. Frontend: `frontend/src/pages/inventory/*`, hub page at `/inventory`.

## Warehouses (`com.mulaerp.warehouse`)

`WarehouseController` (`/api/v1/warehouses`): CRUD is `RoleRules.STOCK_WRITERS` (INVENTORY/MANAGER/ADMIN), plus `GET /{id}/stock` for per-warehouse stock. A default warehouse coded **MAIN** always exists (`WarehouseService.getDefaultWarehouseId()`) and is what PoS sales and stock adjustments post against. `DELETE /warehouses/{id}` throws `IllegalStateException` → **409** if the warehouse still holds any stock (`WarehouseService.deleteWarehouse`) — you must zero it out (transfer/adjust) first.

## Stock model

Two places track quantity, and they must move together:
- `Product.stockQuantity` — the **authoritative total** across all warehouses.
- `warehouse_stock` (`WarehouseStock` entity) — the per-warehouse breakdown.

**Stock quantity is no longer directly editable via the product update endpoint.** `ProductFormPage.tsx` disables/`readOnly`s the Stock Quantity field once a product exists, and `ProductService#updateProduct` accepts but ignores a submitted `stockQuantity` — every stock change must go through an adjustment, transfer, or PO/SO receipt/delivery instead, each of which writes a `StockMovement` row (see Movements ledger below). A brand-new product's opening stock is the one exception: it's seeded via a `StockMovementService.recordMovement(..., ADJUSTMENT, ..., "Opening stock")` call at creation time, not a raw field write.

**Negative stock is rejected.** `InventoryService#adjustStock` computes the resulting quantity before writing and throws `IllegalArgumentException` (→ 400) if it would go below zero, unless the call explicitly allows it (`allowNegative`, not exposed to the API today).

Every code path that changes stock (PoS sale, stock adjustment, transfer completion, PO receipt, SO delivery, trade-in receipt, repair part consumption) updates both `Product.stockQuantity` and `warehouse_stock` in the same transaction, plus writes a `StockMovement` row. PO receipt and SO delivery both attribute the movement to the default `MAIN` warehouse (previously left `warehouseId` null on these two paths). `Product` is sometimes mutated directly rather than through `ProductService` (e.g. `PosSaleService`) — when that happens the Redis product cache must be evicted explicitly via `ProductService.evictProductCache(id)`, or a stale cached DTO with the old quantity will be served.

**Transfers** only move stock when the transfer transitions to `COMPLETED` (`StockTransferController POST /{id}/complete`, `RoleRules.STOCK_WRITERS`) — creating or leaving a transfer `IN_TRANSIT` has no stock effect yet. Completion validates sufficient stock at the source warehouse before decrementing; a completed or cancelled transfer can't have its status changed again (`IllegalStateException`).

## Batch/lot + serial tracking

- Batches (`ProductBatch`) and serials (`ProductSerial`, statuses `IN_STOCK`/`SOLD`/etc.) attach to PO receipt lines and SO items.
- On a sales order line with tracking selected, only existence/product-match/status is validated at order-creation time (`SalesOrderService`) — the **actual decrement happens at delivery**, not at order creation, mirroring how PoS/adjustments validate-then-decrement.
- Delivery (`SalesOrderService`, transition into `DELIVERED`) decrements the matching batch quantity and marks each selected serial `SOLD` against the order's customer — but never touches `Product.stockQuantity` directly for tracked serial lines (confirmed in code comments; only the batch/serial state changes there, the aggregate total is still adjusted through the normal stock movement path elsewhere in the flow).
- PO receipt with batch info creates the `ProductBatch` row (see `ReceivePurchaseOrderRequest.ItemTracking`: batchNumber/manufactureDate/expiryDate).

## Movements ledger (`StockMovementController`, `/api/v1/inventory/movements`)

Append-only `stock_movements` table (`V22` migration added a CHECK constraint on `movement_type`, widened by `V29`, `V34`, `V40`, and `V42`). `MovementType` enum, 14 values, Java and the `chk_stock_movements_type` DB constraint kept in sync: `ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, POS_SALE, SO_DELIVERY, PO_RECEIPT, RECOUNT, TRADE_IN_RECEIPT, REPAIR_PART_CONSUMED, SALE_VOID, TRADE_IN_VOID, SHOP_RESERVE, SHOP_RELEASE, SHOP_VOID`. `TRADE_IN_RECEIPT` (+qty, `PosTradeInService`, an item traded in by a customer entering stock), `REPAIR_PART_CONSUMED` (-qty at a repair job's `IN_REPAIR` transition, `RepairJobService`; the same type reverses with a positive delta if the job is cancelled back out of `IN_REPAIR` — see the `repair-warranty` skill), `SALE_VOID` (+qty, `PosSaleService`, stock returned when a PoS sale is voided — see the `pos` skill; the original `POS_SALE` row is never touched, both stay in the ledger side by side), and `TRADE_IN_VOID` (the equivalent reversal on the trade-in side). The four webshop movement types — `SHOP_RESERVE` (-qty, an online order reserving stock at placement), `SHOP_RELEASE` (+qty, a reservation cancelled/expired with no sale ever happening), and `SHOP_VOID` (+qty, a **fulfilled** web order later voided — deliberately distinct from `SHOP_RELEASE` since a sale actually happened and had to be reversed) — are owned by `com.mulaerp.shop`; see the `webshop` skill for the full lifecycle. `GET /inventory/movements` lists the ledger; `GET /inventory/movements/reconcile/{productId}` compares the ledger's running total against `Product.stockQuantity` for that product — use it to spot drift if the two ever disagree.

## Stock-take (guided physical count, `V32__stock_take_sessions.sql`, `StockTakeController`/`StockTakeService`)

`POST /api/v1/inventory/stock-takes` opens a session for one warehouse (`RoleRules.STOCK_WRITERS`), snapshotting that warehouse's current `warehouse_stock` rows into `stock_take_lines` (`expectedQuantity` = whatever `warehouse_stock.quantity` is *at open time* — so any stock movement that happened before opening, including a void's stock return, is already baked into what staff count against; nothing opened earlier reflects it retroactively). Lifecycle: `OPEN` → (`PUT /{id}/lines/{lineId}`, `STOCK_WRITERS`, records a counted quantity and flips to `COUNTING`) → `POST /{id}/submit` (`STOCK_WRITERS`, requires at least one counted line) → `REVIEW` → `POST /{id}/approve` (`RoleRules.MANAGER_UP` — deliberately a step up from every other action in this workflow, mirroring the PoS void skill's staff/manager split) → `APPROVED`, or `POST /{id}/cancel` (`STOCK_WRITERS`, any pre-`APPROVED` status, no stock effect) at any point before that.

**Approval is the only step that moves stock**, and it does so entirely through the existing `InventoryService#createAdjustment` — one `RECOUNT` adjustment per line whose variance is non-zero (`countedQuantity - expectedQuantity`), so `Product.stockQuantity`/`warehouse_stock`/the `StockMovement` ledger all move exactly as a manual RECOUNT adjustment would; `StockTakeService` never writes stock directly. `approvedBy` is stamped from the authenticated principal, never trusted from client input.

## UI

Hub page `InventoryPage.tsx` at `/inventory` links to warehouses, adjustments, batches, serials, transfers, and movements — routes are all under `/inventory/*` in `App.tsx`. Note: the "Stock Movements" hub tile uses `bg-indigo-600` for its icon background, which is a one-off deviation from the blue-600-only accent rule described in the `frontend-dev` skill — don't copy it as precedent for new indigo/purple usage.
