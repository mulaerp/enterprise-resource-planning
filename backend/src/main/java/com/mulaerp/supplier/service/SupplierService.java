package com.mulaerp.supplier.service;

import com.mulaerp.supplier.dto.*;
import com.mulaerp.supplier.entity.Supplier;
import com.mulaerp.supplier.repository.SupplierRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SupplierService {
    
    private final SupplierRepository supplierRepository;
    
    @Transactional(readOnly = true)
    public Page<SupplierDto> getAllSuppliers(Pageable pageable) {
        return supplierRepository.findByDeletedFalse(pageable)
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public Page<SupplierDto> searchSuppliers(String search, Pageable pageable) {
        return supplierRepository.searchSuppliers(search, pageable)
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public SupplierDto getSupplierById(UUID id) {
        Supplier supplier = supplierRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
        return convertToDto(supplier);
    }
    
    @Transactional
    public SupplierDto createSupplier(CreateSupplierRequest request) {
        Supplier supplier = new Supplier();
        supplier.setName(request.getName());
        supplier.setEmail(request.getEmail());
        supplier.setPhone(request.getPhone());
        supplier.setAddress(request.getAddress());
        supplier.setTaxId(request.getTaxId());
        supplier.setPaymentTerms(request.getPaymentTerms());
        supplier.setStatus(request.getStatus());
        
        Supplier savedSupplier = supplierRepository.save(supplier);
        return convertToDto(savedSupplier);
    }
    
    @Transactional
    public SupplierDto updateSupplier(UUID id, UpdateSupplierRequest request) {
        Supplier supplier = supplierRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
        
        supplier.setName(request.getName());
        supplier.setEmail(request.getEmail());
        supplier.setPhone(request.getPhone());
        supplier.setAddress(request.getAddress());
        supplier.setTaxId(request.getTaxId());
        supplier.setPaymentTerms(request.getPaymentTerms());
        supplier.setStatus(request.getStatus());
        
        Supplier updatedSupplier = supplierRepository.save(supplier);
        return convertToDto(updatedSupplier);
    }
    
    @Transactional
    public void deleteSupplier(UUID id) {
        Supplier supplier = supplierRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
        
        supplier.setDeleted(true);
        supplier.setDeletedAt(LocalDateTime.now());
        supplierRepository.save(supplier);
    }
    
    private SupplierDto convertToDto(Supplier supplier) {
        SupplierDto dto = new SupplierDto();
        dto.setId(supplier.getId());
        dto.setName(supplier.getName());
        dto.setEmail(supplier.getEmail());
        dto.setPhone(supplier.getPhone());
        dto.setAddress(supplier.getAddress());
        dto.setTaxId(supplier.getTaxId());
        dto.setPaymentTerms(supplier.getPaymentTerms());
        dto.setStatus(supplier.getStatus());
        dto.setCreatedAt(supplier.getCreatedAt());
        dto.setUpdatedAt(supplier.getUpdatedAt());
        return dto;
    }
}
