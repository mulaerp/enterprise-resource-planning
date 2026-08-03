package com.mulaerp.accounting.controller;

import com.mulaerp.accounting.dto.AccountDTO;
import com.mulaerp.accounting.dto.DraftPreviewDTO;
import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.dto.PostBatchRequest;
import com.mulaerp.accounting.dto.PostBatchResultDTO;
import com.mulaerp.accounting.dto.TrialBalanceDTO;
import com.mulaerp.accounting.service.AccountingService;
import com.mulaerp.auth.security.RoleRules;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// WP: five-role model - chart-of-accounts mutations and journal entry create/update/POST/delete
// moved OFF admin-only onto RoleRules.ACCOUNTANT_WRITERS (ACCOUNTANT owns posting; MANAGER/ADMIN
// retain it too). Reads (accounts/journal entries/reports) stay open to any authenticated user.
@RestController
@RequestMapping("/api/v1/accounting")
@RequiredArgsConstructor
@Tag(name = "Accounting", description = "Accounting management APIs")
public class AccountingController {

    private final AccountingService accountingService;

    // ============================================
    // Account Endpoints
    // ============================================

    @GetMapping("/accounts")
    @Operation(summary = "Get all accounts")
    public ResponseEntity<List<AccountDTO>> getAllAccounts() {
        return ResponseEntity.ok(accountingService.getAllAccounts());
    }

    @GetMapping("/accounts/{id}")
    @Operation(summary = "Get account by ID")
    public ResponseEntity<AccountDTO> getAccountById(@PathVariable UUID id) {
        return ResponseEntity.ok(accountingService.getAccountById(id));
    }

    @GetMapping("/accounts/code/{code}")
    @Operation(summary = "Get account by code")
    public ResponseEntity<AccountDTO> getAccountByCode(@PathVariable String code) {
        return ResponseEntity.ok(accountingService.getAccountByCode(code));
    }

    @GetMapping("/accounts/search")
    @Operation(summary = "Search accounts")
    public ResponseEntity<List<AccountDTO>> searchAccounts(@RequestParam String query) {
        return ResponseEntity.ok(accountingService.searchAccounts(query));
    }

    @PostMapping("/accounts")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Create new account")
    public ResponseEntity<AccountDTO> createAccount(@RequestBody AccountDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(accountingService.createAccount(dto));
    }

    @PutMapping("/accounts/{id}")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Update account")
    public ResponseEntity<AccountDTO> updateAccount(
            @PathVariable UUID id,
            @RequestBody AccountDTO dto) {
        return ResponseEntity.ok(accountingService.updateAccount(id, dto));
    }

    @DeleteMapping("/accounts/{id}")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Delete account")
    public ResponseEntity<Void> deleteAccount(@PathVariable UUID id) {
        accountingService.deleteAccount(id);
        return ResponseEntity.noContent().build();
    }

    // ============================================
    // Journal Entry Endpoints
    // ============================================

    @GetMapping("/journal-entries")
    @Operation(summary = "Get all journal entries")
    public ResponseEntity<List<JournalEntryDTO>> getAllJournalEntries() {
        return ResponseEntity.ok(accountingService.getAllJournalEntries());
    }

    @GetMapping("/journal-entries/{id}")
    @Operation(summary = "Get journal entry by ID")
    public ResponseEntity<JournalEntryDTO> getJournalEntryById(@PathVariable UUID id) {
        return ResponseEntity.ok(accountingService.getJournalEntryById(id));
    }

    @PostMapping("/journal-entries")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Create new journal entry")
    public ResponseEntity<JournalEntryDTO> createJournalEntry(@RequestBody JournalEntryDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(accountingService.createJournalEntry(dto));
    }

    @PutMapping("/journal-entries/{id}")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Update journal entry")
    public ResponseEntity<JournalEntryDTO> updateJournalEntry(
            @PathVariable UUID id,
            @RequestBody JournalEntryDTO dto) {
        return ResponseEntity.ok(accountingService.updateJournalEntry(id, dto));
    }

    @PostMapping("/journal-entries/{id}/post")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Post journal entry")
    public ResponseEntity<JournalEntryDTO> postJournalEntry(@PathVariable UUID id) {
        return ResponseEntity.ok(accountingService.postJournalEntry(id));
    }

    // WP: fixes the "books report zero" audit finding - draft-preview + batch-post so the ~180
    // auto-generated DRAFT entries (PoS/invoice/payment/repair hooks) can actually reach POSTED
    // without a per-row confirm dialog. Same role gate as the single-entry post above.
    @GetMapping("/journal-entries/drafts/preview")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Preview outstanding draft journal entries in a date range, grouped by source")
    public ResponseEntity<DraftPreviewDTO> previewDrafts(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(accountingService.getDraftsPreview(startDate, endDate));
    }

    @PostMapping("/journal-entries/post-batch")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Post a batch of draft journal entries (by id list or date range) in one all-or-nothing transaction")
    public ResponseEntity<PostBatchResultDTO> postBatch(@RequestBody PostBatchRequest request) {
        return ResponseEntity.ok(accountingService.postBatch(request));
    }

    @DeleteMapping("/journal-entries/{id}")
    @PreAuthorize(RoleRules.ACCOUNTANT_WRITERS)
    @Operation(summary = "Delete journal entry")
    public ResponseEntity<Void> deleteJournalEntry(@PathVariable UUID id) {
        accountingService.deleteJournalEntry(id);
        return ResponseEntity.noContent().build();
    }

    // ============================================
    // Report Endpoints
    // ============================================

    @GetMapping("/reports/trial-balance")
    @Operation(summary = "Get trial balance")
    public ResponseEntity<TrialBalanceDTO> getTrialBalance() {
        return ResponseEntity.ok(accountingService.getTrialBalance());
    }

    @GetMapping("/reports/account-ledger/{accountId}")
    @Operation(summary = "Get account ledger")
    public ResponseEntity<List<JournalEntryLineDTO>> getAccountLedger(@PathVariable UUID accountId) {
        return ResponseEntity.ok(accountingService.getAccountLedger(accountId));
    }
}
