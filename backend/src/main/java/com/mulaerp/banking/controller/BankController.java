package com.mulaerp.banking.controller;

import com.mulaerp.banking.dto.BankImportResultDTO;
import com.mulaerp.banking.dto.BankSummaryDTO;
import com.mulaerp.banking.dto.BankTransactionDTO;
import com.mulaerp.banking.dto.MatchPaymentRequest;
import com.mulaerp.banking.dto.PaymentSuggestionDTO;
import com.mulaerp.banking.service.BankReconciliationService;
import com.mulaerp.auth.security.RoleRules;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bank")
@RequiredArgsConstructor
@Tag(name = "Bank Reconciliation", description = "Bank statement import and reconciliation endpoints")
public class BankController {

    private final BankReconciliationService bankReconciliationService;

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Import a bank statement CSV")
    public ResponseEntity<BankImportResultDTO> importStatement(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(bankReconciliationService.importStatement(file));
    }

    @GetMapping("/transactions")
    @Operation(summary = "List bank transactions")
    public ResponseEntity<Page<BankTransactionDTO>> getTransactions(
            @RequestParam(required = false) Boolean reconciled,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            // Secondary sort on createdAt (insertion time) breaks ties between same-day
            // transactions - txnDate is a business date (no time component), so two statements
            // imported on the same calendar day previously had no deterministic order between
            // them; a freshly-imported row could sort anywhere among same-day rows instead of
            // reliably appearing first, which single-day-heavy reconciliation workflows hit often.
            @PageableDefault(size = 20, sort = { "txnDate", "createdAt" }, direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(bankReconciliationService.getTransactions(reconciled, startDate, endDate, pageable));
    }

    @GetMapping("/transactions/{id}/suggestions")
    @Operation(summary = "Get candidate payments for a bank transaction")
    public ResponseEntity<List<PaymentSuggestionDTO>> getSuggestions(@PathVariable UUID id) {
        return ResponseEntity.ok(bankReconciliationService.getSuggestions(id));
    }

    @PostMapping("/transactions/{id}/match")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Match a bank transaction to a payment")
    public ResponseEntity<BankTransactionDTO> match(@PathVariable UUID id,
                                                     @Valid @RequestBody MatchPaymentRequest request) {
        return ResponseEntity.ok(bankReconciliationService.match(id, request));
    }

    @PostMapping("/transactions/{id}/unmatch")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Unmatch a bank transaction")
    public ResponseEntity<BankTransactionDTO> unmatch(@PathVariable UUID id) {
        return ResponseEntity.ok(bankReconciliationService.unmatch(id));
    }

    @GetMapping("/summary")
    @Operation(summary = "Reconciliation summary counts")
    public ResponseEntity<BankSummaryDTO> getSummary() {
        return ResponseEntity.ok(bankReconciliationService.getSummary());
    }
}
