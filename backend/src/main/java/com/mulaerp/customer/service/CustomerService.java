package com.mulaerp.customer.service;

import com.mulaerp.customer.dto.*;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerService {
    
    private final CustomerRepository customerRepository;
    
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
                .orElseThrow(() -> new RuntimeException("Customer not found"));
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
                .orElseThrow(() -> new RuntimeException("Customer not found"));
        
        customer.setName(request.getName());
        customer.setEmail(request.getEmail());
        customer.setPhone(request.getPhone());
        customer.setAddress(request.getAddress());
        customer.setTaxId(request.getTaxId());
        customer.setCreditLimit(request.getCreditLimit());
        customer.setStatus(request.getStatus());
        
        Customer updatedCustomer = customerRepository.save(customer);
        return convertToDto(updatedCustomer);
    }
    
    @Transactional
    public void deleteCustomer(UUID id) {
        Customer customer = customerRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Customer not found"));
        
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
        return dto;
    }
}
