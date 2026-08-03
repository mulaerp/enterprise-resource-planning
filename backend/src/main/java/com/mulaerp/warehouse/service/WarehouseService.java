package com.mulaerp.warehouse.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.warehouse.dto.CreateWarehouseRequest;
import com.mulaerp.warehouse.dto.UpdateWarehouseRequest;
import com.mulaerp.warehouse.dto.WarehouseDTO;
import com.mulaerp.warehouse.entity.Warehouse;
import com.mulaerp.warehouse.repository.WarehouseRepository;
import com.mulaerp.warehouse.repository.WarehouseStockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final WarehouseStockRepository warehouseStockRepository;

    @Transactional(readOnly = true)
    public Page<WarehouseDTO> getAllWarehouses(Pageable pageable) {
        return warehouseRepository.findByDeletedFalse(pageable)
                .map(this::convertToDto);
    }

    @Transactional(readOnly = true)
    public Page<WarehouseDTO> searchWarehouses(String search, Pageable pageable) {
        return warehouseRepository.searchWarehouses(search, pageable)
                .map(this::convertToDto);
    }

    @Transactional(readOnly = true)
    public WarehouseDTO getWarehouseById(UUID id) {
        Warehouse warehouse = warehouseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + id));
        return convertToDto(warehouse);
    }

    /**
     * Resolves the id of the default (MAIN) warehouse, used when a stock adjustment or other
     * legacy flow does not specify a warehouse explicitly. Looked up by code rather than a
     * hardcoded id since the row's id is environment-specific - see V16__create_warehouses.sql.
     */
    @Transactional(readOnly = true)
    public UUID getDefaultWarehouseId() {
        return warehouseRepository.findByCodeAndDeletedFalse(Warehouse.DEFAULT_CODE)
                .map(Warehouse::getId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Default warehouse (code=" + Warehouse.DEFAULT_CODE + ") not found - check V16 migration"));
    }

    @Transactional
    public WarehouseDTO createWarehouse(CreateWarehouseRequest request) {
        if (warehouseRepository.existsByCodeAndDeletedFalse(request.getCode())) {
            throw new IllegalArgumentException("Warehouse code already exists: " + request.getCode());
        }

        Warehouse warehouse = new Warehouse();
        warehouse.setCode(request.getCode());
        warehouse.setName(request.getName());
        warehouse.setLocation(request.getLocation());
        warehouse.setActive(request.getActive() != null ? request.getActive() : true);

        Warehouse saved = warehouseRepository.save(warehouse);
        return convertToDto(saved);
    }

    @Transactional
    public WarehouseDTO updateWarehouse(UUID id, UpdateWarehouseRequest request) {
        Warehouse warehouse = warehouseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + id));

        if (!warehouse.getCode().equals(request.getCode())
                && warehouseRepository.existsByCodeAndDeletedFalse(request.getCode())) {
            throw new IllegalArgumentException("Warehouse code already exists: " + request.getCode());
        }

        warehouse.setCode(request.getCode());
        warehouse.setName(request.getName());
        warehouse.setLocation(request.getLocation());
        if (request.getActive() != null) {
            warehouse.setActive(request.getActive());
        }

        Warehouse updated = warehouseRepository.save(warehouse);
        return convertToDto(updated);
    }

    @Transactional
    public void deleteWarehouse(UUID id) {
        Warehouse warehouse = warehouseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + id));

        if (warehouseStockRepository.existsByWarehouseIdAndQuantityGreaterThan(id, 0)) {
            throw new IllegalStateException(
                    "Cannot delete warehouse " + warehouse.getCode() + ": it still holds stock");
        }

        warehouse.setDeleted(true);
        warehouse.setDeletedAt(LocalDateTime.now());
        warehouseRepository.save(warehouse);
    }

    private WarehouseDTO convertToDto(Warehouse warehouse) {
        WarehouseDTO dto = new WarehouseDTO();
        dto.setId(warehouse.getId());
        dto.setCode(warehouse.getCode());
        dto.setName(warehouse.getName());
        dto.setLocation(warehouse.getLocation());
        dto.setActive(warehouse.getActive());
        dto.setCreatedAt(warehouse.getCreatedAt());
        dto.setUpdatedAt(warehouse.getUpdatedAt());
        return dto;
    }
}
