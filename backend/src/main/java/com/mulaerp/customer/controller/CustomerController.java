package com.mulaerp.customer.controller;

import com.mulaerp.customer.dto.*;
import com.mulaerp.customer.service.CustomerService;
import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.util.PageSizeCap;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

// WP: five-role model - CASHIER may CREATE a walk-in customer (RoleRules.CUSTOMER_MEMBER_CREATE)
// but not update/delete/import (RoleRules.MANAGER_UP, unchanged from before); every GET stays open
// to any authenticated user.
@RestController
@RequestMapping("/api/v1/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    public ResponseEntity<Page<CustomerDto>> getAllCustomers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), sort);

        Page<CustomerDto> customers = search != null && !search.isEmpty()
                ? customerService.searchCustomers(search, pageable)
                : customerService.getAllCustomers(pageable);

        return ResponseEntity.ok(customers);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomerDto> getCustomerById(@PathVariable UUID id) {
        CustomerDto customer = customerService.getCustomerById(id);
        return ResponseEntity.ok(customer);
    }

    @PostMapping
    @PreAuthorize(RoleRules.CUSTOMER_MEMBER_CREATE)
    public ResponseEntity<CustomerDto> createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        CustomerDto customer = customerService.createCustomer(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(customer);
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<CustomerDto> updateCustomer(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCustomerRequest request
    ) {
        CustomerDto customer = customerService.updateCustomer(id, request);
        return ResponseEntity.ok(customer);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<Void> deleteCustomer(@PathVariable UUID id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize(RoleRules.MANAGER_UP)
    @Operation(summary = "Bulk import customers from a CSV file",
            description = "Columns (case/whitespace-insensitive, any order): name, email, phone, "
                    + "address (optional). Only name is mandatory - a header row is required. Rows "
                    + "missing a name are skipped and counted (not reported as errors). Rows that "
                    + "parse but fail validation are reported in `errors` (capped at 20, 1-based CSV "
                    + "line number). An existing email, or an email repeated within the file, is "
                    + "counted under `duplicates` rather than failing the row; rows without an email "
                    + "are never deduped.")
    public ResponseEntity<CustomerImportResultDTO> importCustomers(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(customerService.importCustomers(file));
    }
}
