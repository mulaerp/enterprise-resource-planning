package com.mulaerp.accounting.controller;

import com.mulaerp.accounting.dto.AccountDTO;
import com.mulaerp.accounting.dto.JournalEntryDTO;
import com.mulaerp.accounting.dto.JournalEntryLineDTO;
import com.mulaerp.accounting.dto.TrialBalanceDTO;
import com.mulaerp.accounting.service.AccountingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

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
    @Operation(summary = "Create new account")
    public ResponseEntity<AccountDTO> createAccount(@RequestBody AccountDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(accountingService.createAccount(dto));
    }

    @PutMapping("/accounts/{id}")
    @Operation(summary = "Update account")
    public ResponseEntity<AccountDTO> updateAccount(
            @PathVariable UUID id,
            @RequestBody AccountDTO dto) {
        return ResponseEntity.ok(accountingService.updateAccount(id, dto));
    }

    @DeleteMapping("/accounts/{id}")
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
    @Operation(summary = "Create new journal entry")
    public ResponseEntity<JournalEntryDTO> createJournalEntry(@RequestBody JournalEntryDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(accountingService.createJournalEntry(dto));
    }

    @PutMapping("/journal-entries/{id}")
    @Operation(summary = "Update journal entry")
    public ResponseEntity<JournalEntryDTO> updateJournalEntry(
            @PathVariable UUID id,
            @RequestBody JournalEntryDTO dto) {
        return ResponseEntity.ok(accountingService.updateJournalEntry(id, dto));
    }

    @PostMapping("/journal-entries/{id}/post")
    @Operation(summary = "Post journal entry")
    public ResponseEntity<JournalEntryDTO> postJournalEntry(@PathVariable UUID id) {
        return ResponseEntity.ok(accountingService.postJournalEntry(id));
    }

    @DeleteMapping("/journal-entries/{id}")
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
