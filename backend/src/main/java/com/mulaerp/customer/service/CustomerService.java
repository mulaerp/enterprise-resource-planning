package com.mulaerp.customer.service;

import com.mulaerp.customer.dto.*;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private static final int MAX_IMPORT_ERRORS = 20;

    private final CustomerRepository customerRepository;
    private final Validator validator;

    @Transactional(readOnly = true)
    public Page<CustomerDto> getAllCustomers(Pageable pageable) {
        return customerRepository.findByDeletedFalse(pageable)
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public Page<CustomerDto> searchCustomers(String search, Pageable pageable) {
        return customerRepository.searchCustomers(search, pageable)
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public CustomerDto getCustomerById(UUID id) {
        Customer customer = customerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        return convertToDto(customer);
    }
    
    @Transactional
    public CustomerDto createCustomer(CreateCustomerRequest request) {
        Customer customer = new Customer();
        customer.setName(request.getName());
        customer.setEmail(request.getEmail());
        customer.setPhone(request.getPhone());
        customer.setAddress(request.getAddress());
        customer.setTaxId(request.getTaxId());
        customer.setCreditLimit(request.getCreditLimit());
        customer.setStatus(request.getStatus());
        
        Customer savedCustomer = customerRepository.save(customer);
        return convertToDto(savedCustomer);
    }
    
    @Transactional
    public CustomerDto updateCustomer(UUID id, UpdateCustomerRequest request) {
        Customer customer = customerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        // WP12: see ProductService#updateProduct for why this explicit check is needed on top of
        // Hibernate's own @Version handling in a find-modify-save flow.
        if (request.getVersion() != null && !request.getVersion().equals(customer.getVersion())) {
            throw new ObjectOptimisticLockingFailureException(Customer.class, id);
        }

        customer.setName(request.getName());
        customer.setEmail(request.getEmail());
        customer.setPhone(request.getPhone());
        customer.setAddress(request.getAddress());
        customer.setTaxId(request.getTaxId());
        customer.setCreditLimit(request.getCreditLimit());
        customer.setStatus(request.getStatus());

        // WP12: saveAndFlush so the version increment is visible on `customer` before
        // convertToDto() reads it - see ProductService#updateProduct for the full rationale.
        Customer updatedCustomer = customerRepository.saveAndFlush(customer);
        return convertToDto(updatedCustomer);
    }
    
    /**
     * WP10: bulk-imports customers from a CSV file, reusing {@link #createCustomer} for every row
     * - never raw SQL. Tolerant, mirroring {@code BankStatementParser}: rows missing a name are
     * silently skipped and counted (see {@link CustomerCsvParser}); rows that parse but fail
     * validation, or whose email collides with an existing/already-seen row, are reported back
     * instead of aborting the rest of the file.
     */
    @Transactional
    public CustomerImportResultDTO importCustomers(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("CSV file is required");
        }

        CustomerCsvParser.ParseResult parseResult;
        try {
            parseResult = new CustomerCsvParser().parse(file.getInputStream());
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read CSV file: " + e.getMessage());
        }

        int imported = 0;
        int duplicates = 0;
        List<CustomerImportResultDTO.ImportRowError> errors = new ArrayList<>();
        Set<String> emailsSeenThisBatch = new HashSet<>();

        for (CustomerCsvParser.ParsedRow row : parseResult.getRows()) {
            String normalizedEmail = row.email() != null ? row.email().toLowerCase() : null;

            if (normalizedEmail != null) {
                boolean duplicateInBatch = !emailsSeenThisBatch.add(normalizedEmail);
                boolean duplicateExisting = customerRepository.findByEmailIgnoreCaseAndDeletedFalse(normalizedEmail).isPresent();
                if (duplicateInBatch || duplicateExisting) {
                    duplicates++;
                    continue;
                }
            }

            try {
                CreateCustomerRequest request = new CreateCustomerRequest();
                request.setName(row.name());
                request.setEmail(row.email());
                request.setPhone(row.phone());
                request.setAddress(row.address());
                request.setStatus("ACTIVE");

                Set<ConstraintViolation<CreateCustomerRequest>> violations = validator.validate(request);
                if (!violations.isEmpty()) {
                    String message = violations.stream()
                            .map(ConstraintViolation::getMessage)
                            .collect(Collectors.joining("; "));
                    addError(errors, row.lineNumber(), message);
                    continue;
                }

                createCustomer(request);
                imported++;
            } catch (Exception e) {
                addError(errors, row.lineNumber(), e.getMessage());
            }
        }

        log.info("[CustomerImport] {} imported, {} skipped, {} duplicates, {} error row(s)",
                imported, parseResult.getSkipped(), duplicates, errors.size());

        return new CustomerImportResultDTO(imported, parseResult.getSkipped(), duplicates, errors);
    }

    private void addError(List<CustomerImportResultDTO.ImportRowError> errors, int lineNumber, String message) {
        if (errors.size() < MAX_IMPORT_ERRORS) {
            errors.add(new CustomerImportResultDTO.ImportRowError(lineNumber, message));
        }
    }

    @Transactional
    public void deleteCustomer(UUID id) {
        Customer customer = customerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        
        customer.setDeleted(true);
        customer.setDeletedAt(LocalDateTime.now());
        customerRepository.save(customer);
    }
    
    private CustomerDto convertToDto(Customer customer) {
        CustomerDto dto = new CustomerDto();
        dto.setId(customer.getId());
        dto.setName(customer.getName());
        dto.setEmail(customer.getEmail());
        dto.setPhone(customer.getPhone());
        dto.setAddress(customer.getAddress());
        dto.setTaxId(customer.getTaxId());
        dto.setCreditLimit(customer.getCreditLimit());
        dto.setStatus(customer.getStatus());
        dto.setCreatedAt(customer.getCreatedAt());
        dto.setUpdatedAt(customer.getUpdatedAt());
        dto.setVersion(customer.getVersion());
        return dto;
    }
}
