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
 * WP8 (d): the PoS sale flow - member + voucher discount stacking, stock decrement across both
 * Product.stockQuantity and the MAIN warehouse's warehouse_stock row (a product freshly created
 * via POST /products has *no* warehouse_stock row at all - see WarehouseStockService - so a sale
 * only succeeds once a stock adjustment has seeded it; this is exactly the kind of cross-module
 * wiring gap a unit test mocking PosSaleService's collaborators would never catch), idempotent
 * replay via clientSaleId, and member points accrual/tier recompute.
 */
class PosFlowIT extends BaseIntegrationTest {

    @Test
    void memberVoucherSaleDiscountMathStockAndIdempotentReplay() {
        String suffix = uniqueSuffix();

        // ---- Product, seeded into MAIN warehouse stock via an adjustment ---------------------
        ResponseEntity<JsonNode> productResp = post("/products", body(
                "sku", "SKU-POS-" + suffix,
                "name", "PoS Flow Product " + suffix,
                "unitPrice", 50.00,
                "costPrice", 20.00,
                "acquisitionCost", 20.00,
                "stockQuantity", 0,
                "reorderLevel", 5,
                "status", "ACTIVE"
        ));
        assertThat(productResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = UUID.fromString(productResp.getBody().get("id").asText());

        ResponseEntity<JsonNode> adjustmentResp = createStockAdjustment(body(
                "productId", productId.toString(),
                "adjustmentType", "INCREASE",
                "quantityAdjusted", 50,
                "reason", "Seed stock for PosFlowIT",
                "adjustmentDate", LocalDate.now().toString()
        ));
        assertThat(adjustmentResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // ---- Sale 1: no member, no voucher, exact cash tender --------------------------------
        String clientSaleId1 = "posflowit-" + suffix + "-1";
        var sale1Body = body(
                "clientSaleId", clientSaleId1,
                "paymentMethod", "CASH",
                "amountTendered", 250.00,
                "lines", List.of(body(
                        "productId", productId.toString(),
                        "quantity", 5,
                        "unitPrice", 50.00
                ))
        );
        ResponseEntity<JsonNode> sale1Resp = post("/pos/sales", sale1Body);
        assertThat(sale1Resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode sale1 = sale1Resp.getBody();
        assertThat(sale1.get("subtotal").asDouble()).isEqualTo(250.00);
        assertThat(sale1.get("discountTotal").asDouble()).isEqualTo(0.00);
        assertThat(sale1.get("total").asDouble()).isEqualTo(250.00);
        assertThat(sale1.get("change").asDouble()).isEqualTo(0.00);
        assertThat(sale1.get("pointsEarned").asInt()).isEqualTo(250);
        String saleNumber1 = sale1.get("saleNumber").asText();

        assertThat(get("/products/" + productId).getBody().get("stockQuantity").asInt()).isEqualTo(45);

        // ---- Idempotent replay: same clientSaleId, must not repeat the stock decrement -------
        ResponseEntity<JsonNode> replayResp = post("/pos/sales", sale1Body);
        assertThat(replayResp.getStatusCode()).isEqualTo(HttpStatus.OK); // 200, not 201 - see PosSaleController Javadoc
        assertThat(replayResp.getBody().get("saleNumber").asText()).isEqualTo(saleNumber1);
        assertThat(get("/products/" + productId).getBody().get("stockQuantity").asInt())
                .as("replaying a clientSaleId must not decrement stock a second time")
                .isEqualTo(45);

        // ---- Member: accrue enough points in one sale to cross the SILVER threshold (>=500) --
        ResponseEntity<JsonNode> memberResp = post("/members", body(
                "name", "PoS Flow Member " + suffix,
                "phone", "+60-12-" + suffix,
                "email", "pos-flow-" + suffix + "@example.test"
        ));
        assertThat(memberResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID memberId = UUID.fromString(memberResp.getBody().get("id").asText());
        assertThat(memberResp.getBody().get("tier").asText()).isEqualTo("BASIC");
        assertThat(memberResp.getBody().get("discountPercent").asDouble()).isEqualTo(0.00);

        var sale2Body = body(
                "clientSaleId", "posflowit-" + suffix + "-2",
                "memberId", memberId.toString(),
                "paymentMethod", "CARD",
                "lines", List.of(body(
                        "productId", productId.toString(),
                        "quantity", 11,
                        "unitPrice", 50.00
                ))
        );
        ResponseEntity<JsonNode> sale2Resp = post("/pos/sales", sale2Body);
        assertThat(sale2Resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(sale2Resp.getBody().get("total").asDouble()).isEqualTo(550.00);
        assertThat(sale2Resp.getBody().get("pointsEarned").asInt()).isEqualTo(550);

        JsonNode memberAfterSale2 = get("/members/" + memberId).getBody();
        assertThat(memberAfterSale2.get("points").asInt()).isEqualTo(550);
        assertThat(memberAfterSale2.get("tier").asText()).isEqualTo("SILVER");
        assertThat(memberAfterSale2.get("discountPercent").asDouble()).isEqualTo(5.00);

        // ---- Voucher --------------------------------------------------------------------------
        String voucherCode = "POSFLOW" + suffix.toUpperCase();
        ResponseEntity<JsonNode> voucherResp = post("/vouchers", body(
                "code", voucherCode,
                "type", "PERCENT",
                "value", 10,
                "usageLimit", 5
        ));
        assertThat(voucherResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // ---- Sale 3: member discount (5%) + voucher discount (10%) + cart discount, stacked
        // sequentially per PosSaleService's documented order. subtotal=200:
        //   memberDiscount   = 200 * 5%          = 10.00 -> afterMember   = 190.00
        //   voucherDiscount  = 190 * 10%         = 19.00 -> afterVoucher  = 171.00
        //   cartDiscount                          =  1.00 -> total        = 170.00
        var sale3Body = body(
                "clientSaleId", "posflowit-" + suffix + "-3",
                "memberId", memberId.toString(),
                "voucherCode", voucherCode,
                "paymentMethod", "EWALLET",
                "cartDiscount", 1.00,
                "lines", List.of(body(
                        "productId", productId.toString(),
                        "quantity", 4,
                        "unitPrice", 50.00
                ))
        );
        ResponseEntity<JsonNode> sale3Resp = post("/pos/sales", sale3Body);
        assertThat(sale3Resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode sale3 = sale3Resp.getBody();
        assertThat(sale3.get("subtotal").asDouble()).isEqualTo(200.00);
        assertThat(sale3.get("discountTotal").asDouble()).isEqualTo(30.00);
        assertThat(sale3.get("total").asDouble()).isEqualTo(170.00);
        assertThat(sale3.get("voucherCode").asText()).isEqualTo(voucherCode);

        // Final stock: 50 seeded - 5 (sale1) - 11 (sale2) - 4 (sale3) = 30. The idempotent replay
        // of sale1 must not have subtracted anything extra.
        assertThat(get("/products/" + productId).getBody().get("stockQuantity").asInt()).isEqualTo(30);

        // ---- Voucher usage count incremented by the applied sale ------------------------------
        ResponseEntity<JsonNode> voucherValidate = post("/vouchers/validate", body(
                "code", voucherCode,
                "subtotal", 100.00
        ));
        assertThat(voucherValidate.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(voucherValidate.getBody().get("valid").asBoolean()).isTrue();
    }

    @Test
    void saleWithInsufficientStockReturns400() {
        String suffix = uniqueSuffix();
        ResponseEntity<JsonNode> productResp = post("/products", body(
                "sku", "SKU-POS-NOSTOCK-" + suffix,
                "name", "No Stock Product " + suffix,
                "unitPrice", 10.00,
                "costPrice", 5.00,
                "stockQuantity", 0,
                "reorderLevel", 1,
                "status", "ACTIVE"
        ));
        assertThat(productResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = UUID.fromString(productResp.getBody().get("id").asText());

        // No stock adjustment at all - product has zero stock everywhere, so any sale must fail.
        ResponseEntity<JsonNode> saleResp = post("/pos/sales", body(
                "clientSaleId", "posflowit-nostock-" + suffix,
                "paymentMethod", "CASH",
                "amountTendered", 10.00,
                "lines", List.of(body(
                        "productId", productId.toString(),
                        "quantity", 1,
                        "unitPrice", 10.00
                ))
        ));
        assertThat(saleResp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
