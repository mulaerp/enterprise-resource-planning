package com.mulaerp.company.controller;

import com.mulaerp.company.dto.CompanyDTO;
import com.mulaerp.company.dto.CreateCompanyRequest;
import com.mulaerp.company.service.CompanyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/companies")
@RequiredArgsConstructor
@Tag(name = "Companies", description = "Company management endpoints")
public class CompanyController {

    private final CompanyService companyService;

    @GetMapping
    @Operation(summary = "Get all companies")
    public ResponseEntity<Page<CompanyDTO>> getAllCompanies(Pageable pageable) {
        return ResponseEntity.ok(companyService.getAllCompanies(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get company by ID")
    public ResponseEntity<CompanyDTO> getCompanyById(@PathVariable UUID id) {
        return ResponseEntity.ok(companyService.getCompanyById(id));
    }

    @PostMapping
    @Operation(summary = "Create company")
    public ResponseEntity<CompanyDTO> createCompany(
            @Valid @RequestBody CreateCompanyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(companyService.createCompany(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update company")
    public ResponseEntity<CompanyDTO> updateCompany(
            @PathVariable UUID id,
            @Valid @RequestBody CreateCompanyRequest request) {
        return ResponseEntity.ok(companyService.updateCompany(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete company")
    public ResponseEntity<Void> deleteCompany(@PathVariable UUID id) {
        companyService.deleteCompany(id);
        return ResponseEntity.noContent().build();
    }
}
