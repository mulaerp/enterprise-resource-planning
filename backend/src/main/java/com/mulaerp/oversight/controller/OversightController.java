package com.mulaerp.oversight.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.oversight.dto.CashUpResponseDto;
import com.mulaerp.oversight.dto.ExceptionsResponseDto;
import com.mulaerp.oversight.dto.ItemTraceResponseDto;
import com.mulaerp.oversight.dto.MoneyFlowResponseDto;
import com.mulaerp.oversight.dto.SaveCashUpRequest;
import com.mulaerp.oversight.service.CashUpService;
import com.mulaerp.oversight.service.ExceptionsService;
import com.mulaerp.oversight.service.ItemTraceService;
import com.mulaerp.oversight.service.MoneyFlowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Branch-manager oversight views: item trace, money-flow/day-book, exceptions, and cash-up - all
 * {@link RoleRules#MANAGER_UP} (branch manager + admin), per the approved design. Every endpoint is
 * read-only except the cash-up POST, which only ever writes to the oversight module's own
 * {@code cash_ups} table.
 */
@RestController
@RequestMapping("/api/v1/oversight")
@RequiredArgsConstructor
@PreAuthorize(RoleRules.MANAGER_UP)
public class OversightController {

    private final ItemTraceService itemTraceService;
    private final MoneyFlowService moneyFlowService;
    private final ExceptionsService exceptionsService;
    private final CashUpService cashUpService;

    @GetMapping("/trace/item")
    public ResponseEntity<ItemTraceResponseDto> traceItem(
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) String serial,
            @RequestParam(required = false) UUID productId
    ) {
        return ResponseEntity.ok(itemTraceService.traceItem(sku, serial, productId));
    }

    @GetMapping("/money-flow")
    public ResponseEntity<MoneyFlowResponseDto> moneyFlow(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to
    ) {
        return ResponseEntity.ok(moneyFlowService.getMoneyFlow(from, to));
    }

    @GetMapping("/exceptions")
    public ResponseEntity<ExceptionsResponseDto> exceptions(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to
    ) {
        return ResponseEntity.ok(exceptionsService.getExceptions(from, to));
    }

    @GetMapping("/cashup")
    public ResponseEntity<CashUpResponseDto> getCashUp(@RequestParam LocalDate date) {
        return ResponseEntity.ok(cashUpService.getCashUp(date));
    }

    @PostMapping("/cashup")
    public ResponseEntity<CashUpResponseDto> saveCashUp(@Valid @RequestBody SaveCashUpRequest request) {
        return ResponseEntity.ok(cashUpService.saveCashUp(request));
    }
}
