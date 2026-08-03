package com.mulaerp.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WP8 (c): the core order-to-cash flow - customer, product, a stock adjustment to bring the
 * product into stock, an invoice against that customer/product, and a payment against that
 * invoice - plus the auto-journal side effects each step is documented to produce
 * (InvoiceService#createInvoiceJournalEntry, PaymentService#createPaymentJournalEntry) and the
 * 404 contract for unknown resources.
 */
class SalesFlowIT extends BaseIntegrationTest {

    @Test
    void customerProductAdjustmentInvoicePaymentAndJournalPosting() {
        String suffix = uniqueSuffix();

        // ---- Customer ---------------------------------------------------------------------
        ResponseEntity<JsonNode> customerResp = post("/customers", body(
                "name", "Sales Flow Customer " + suffix,
                "email", "sales-flow-" + suffix + "@example.test",
                "phone", "+60-3-" + suffix,
                "status", "ACTIVE"
        ));
        assertThat(customerResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID customerId = UUID.fromString(customerResp.getBody().get("id").asText());

        // ---- Product ------------------------------------------------------------------------
        ResponseEntity<JsonNode> productResp = post("/products", body(
                "sku", "SKU-SALES-" + suffix,
                "name", "Sales Flow Product " + suffix,
                "unitPrice", 100.00,
                "costPrice", 40.00,
                "stockQuantity", 0,
                "reorderLevel", 5,
                "status", "ACTIVE"
        ));
        assertThat(productResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = UUID.fromString(productResp.getBody().get("id").asText());

        // ---- Stock adjustment (bring the product into stock) --------------------------------
        ResponseEntity<JsonNode> adjustmentResp = createStockAdjustment(body(
                "productId", productId.toString(),
                "adjustmentType", "INCREASE",
                "quantityAdjusted", 20,
                "reason", "Initial stock for SalesFlowIT",
                "adjustmentDate", LocalDate.now().toString()
        ));
        assertThat(adjustmentResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(adjustmentResp.getBody().get("quantityAfter").asInt()).isEqualTo(20);

        ResponseEntity<JsonNode> productAfterAdjustment = get("/products/" + productId);
        assertThat(productAfterAdjustment.getBody().get("stockQuantity").asInt()).isEqualTo(20);

        // ---- Invoice --------------------------------------------------------------------------
        ResponseEntity<JsonNode> invoiceResp = post("/invoices", body(
                "customerId", customerId.toString(),
                "invoiceDate", LocalDate.now().toString(),
                "dueDate", LocalDate.now().plusDays(30).toString(),
                "tax", 0,
                "items", List.of(body(
                        "productId", productId.toString(),
                        "description", "Sales Flow Product " + suffix,
                        "quantity", 3,
                        "unitPrice", 100.00
                ))
        ));
        assertThat(invoiceResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode invoice = invoiceResp.getBody();
        UUID invoiceId = UUID.fromString(invoice.get("id").asText());
        String invoiceNumber = invoice.get("invoiceNumber").asText();
        assertThat(invoice.get("status").asText()).isEqualTo("DRAFT");
        assertThat(invoice.get("total").asDouble()).isEqualTo(300.00);
        assertThat(invoice.get("balanceDue").asDouble()).isEqualTo(300.00);

        // ---- Journal entry auto-created for the invoice, auto-posted immediately -------------
        // (mulaerp.accounting.auto-post-system-entries default true - see AccountingService
        // #createSystemEntry; this used to land DRAFT and need a separate post step, before the
        // PoS void/refund + auto-posting change).
        JsonNode invoiceJournalEntry = findJournalEntryByReference(invoiceNumber);
        assertThat(invoiceJournalEntry).as("invoice must auto-create a journal entry").isNotNull();
        assertThat(invoiceJournalEntry.get("status").asText()).isEqualTo("POSTED");
        assertBalanced(invoiceJournalEntry);

        // ---- Payment (in full) ----------------------------------------------------------------
        ResponseEntity<JsonNode> paymentResp = post("/payments", body(
                "invoiceId", invoiceId.toString(),
                "paymentDate", LocalDate.now().toString(),
                "amount", 300.00,
                "method", "BANK_TRANSFER"
        ));
        assertThat(paymentResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String paymentNumber = paymentResp.getBody().get("paymentNumber").asText();

        ResponseEntity<JsonNode> invoiceAfterPayment = get("/invoices/" + invoiceId);
        assertThat(invoiceAfterPayment.getBody().get("status").asText()).isEqualTo("PAID");
        assertThat(invoiceAfterPayment.getBody().get("balanceDue").asDouble()).isEqualTo(0.00);

        // ---- Journal entry auto-created for the payment, also auto-posted immediately --------
        JsonNode paymentJournalEntry = findJournalEntryByReference(paymentNumber);
        assertThat(paymentJournalEntry).as("payment must auto-create a journal entry").isNotNull();
        assertThat(paymentJournalEntry.get("status").asText()).isEqualTo("POSTED");
        assertBalanced(paymentJournalEntry);

        // Already posted (by auto-posting, not a manual post call) - posting it again must still
        // be rejected by the already-posted guard rather than silently succeeding.
        UUID paymentEntryId = UUID.fromString(paymentJournalEntry.get("id").asText());
        ResponseEntity<JsonNode> postAgainResp = post("/accounting/journal-entries/" + paymentEntryId + "/post", null);
        assertThat(postAgainResp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void unknownInvoiceAndPaymentReturn404Json() {
        UUID randomId = UUID.randomUUID();

        ResponseEntity<JsonNode> invoiceResp = get("/invoices/" + randomId);
        assertThat(invoiceResp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(invoiceResp.getBody().get("status").asInt()).isEqualTo(404);
        assertThat(invoiceResp.getBody().get("path").asText()).isEqualTo("/api/v1/invoices/" + randomId);

        ResponseEntity<JsonNode> paymentResp = get("/payments/" + randomId);
        assertThat(paymentResp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(paymentResp.getBody().get("status").asInt()).isEqualTo(404);
    }

    private JsonNode findJournalEntryByReference(String reference) {
        ResponseEntity<JsonNode> allEntries = get("/accounting/journal-entries");
        assertThat(allEntries.getStatusCode()).isEqualTo(HttpStatus.OK);
        for (JsonNode entry : allEntries.getBody()) {
            if (reference.equals(entry.get("reference").asText())) {
                return entry;
            }
        }
        return null;
    }

    private void assertBalanced(JsonNode entry) {
        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;
        for (JsonNode line : entry.get("lines")) {
            totalDebit = totalDebit.add(new BigDecimal(line.get("debit").asText()));
            totalCredit = totalCredit.add(new BigDecimal(line.get("credit").asText()));
        }
        assertThat(totalDebit).isEqualByComparingTo(totalCredit);
    }
}
