package com.mulaerp.company.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.company.dto.CompanyDTO;
import com.mulaerp.company.dto.CreateCompanyRequest;
import com.mulaerp.company.entity.Company;
import com.mulaerp.company.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;

    // NOTE: intentionally not @Cacheable - RedisCacheManager's Jackson serializer (see
    // CacheConfig) cannot deserialize org.springframework.data.domain.PageImpl (no default
    // constructor/Creator), so caching a Page<> here 500s on every read.
    @Transactional(readOnly = true)
    public Page<CompanyDTO> getAllCompanies(Pageable pageable) {
        return companyRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "company", key = "#id")
    public CompanyDTO getCompanyById(UUID id) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
        return convertToDTO(company);
    }

    @Transactional
    @CacheEvict(value = {"companies", "company"}, allEntries = true)
    public CompanyDTO createCompany(CreateCompanyRequest request) {
        Company company = new Company();
        company.setName(request.getName());
        company.setTaxId(request.getTaxId());
        company.setAddress(request.getAddress());
        company.setPhone(request.getPhone());
        company.setEmail(request.getEmail());
        company.setCurrency(request.getCurrency() != null ? request.getCurrency() : "USD");
        company.setLogo(request.getLogo());
        company.setStatus(Company.CompanyStatus.ACTIVE);

        Company saved = companyRepository.save(company);
        return convertToDTO(saved);
    }

    @Transactional
    @CacheEvict(value = {"companies", "company"}, allEntries = true)
    public CompanyDTO updateCompany(UUID id, CreateCompanyRequest request) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));

        company.setName(request.getName());
        company.setTaxId(request.getTaxId());
        company.setAddress(request.getAddress());
        company.setPhone(request.getPhone());
        company.setEmail(request.getEmail());
        company.setCurrency(request.getCurrency());
        company.setLogo(request.getLogo());

        Company updated = companyRepository.save(company);
        return convertToDTO(updated);
    }

    @Transactional
    @CacheEvict(value = {"companies", "company"}, allEntries = true)
    public void deleteCompany(UUID id) {
        Company company = companyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
        companyRepository.delete(company);
    }

    private CompanyDTO convertToDTO(Company company) {
        CompanyDTO dto = new CompanyDTO();
        dto.setId(company.getId());
        dto.setName(company.getName());
        dto.setTaxId(company.getTaxId());
        dto.setAddress(company.getAddress());
        dto.setPhone(company.getPhone());
        dto.setEmail(company.getEmail());
        dto.setCurrency(company.getCurrency());
        dto.setLogo(company.getLogo());
        dto.setStatus(company.getStatus());
        dto.setCreatedAt(company.getCreatedAt());
        dto.setUpdatedAt(company.getUpdatedAt());
        return dto;
    }
}
