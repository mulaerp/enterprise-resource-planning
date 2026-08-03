package com.mulaerp.company.service;

import com.mulaerp.company.entity.Company;
import com.mulaerp.company.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared helper for WP5's report/document exports: reads the company name from the company
 * settings the app already has (CompanyRepository), falling back to "Mula ERP" when none has
 * been configured yet.
 */
@Component
@RequiredArgsConstructor
public class CompanyNameResolver {

    private final CompanyRepository companyRepository;

    @Transactional(readOnly = true)
    public String resolveName() {
        return companyRepository.findAll(PageRequest.of(0, 1)).stream()
                .findFirst()
                .map(Company::getName)
                .orElse("Mula ERP");
    }

    @Transactional(readOnly = true)
    public Company resolveCompany() {
        return companyRepository.findAll(PageRequest.of(0, 1)).stream()
                .findFirst()
                .orElse(null);
    }
}
