package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.CreateBatchRequest;
import com.mulaerp.inventory.dto.ProductBatchDTO;
import com.mulaerp.inventory.entity.ProductBatch;
import com.mulaerp.inventory.repository.ProductBatchRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BatchTrackingService {

    private final ProductBatchRepository batchRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<ProductBatchDTO> getAllBatches() {
        return batchRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductBatchDTO getBatchById(UUID id) {
        ProductBatch batch = batchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + id));
        return convertToDTO(batch);
    }

    @Transactional(readOnly = true)
    public ProductBatchDTO getBatchByNumber(String batchNumber) {
        ProductBatch batch = batchRepository.findByBatchNumber(batchNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found with number: " + batchNumber));
        return convertToDTO(batch);
    }

    @Transactional(readOnly = true)
    public List<ProductBatchDTO> getBatchesByProduct(UUID productId) {
        return batchRepository.findByProductId(productId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductBatchDTO> getActiveBatchesByProduct(UUID productId) {
        return batchRepository.findByProductIdAndStatus(productId, ProductBatch.BatchStatus.ACTIVE).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductBatchDTO> getExpiringBatches(int daysAhead) {
        LocalDate expiryDate = LocalDate.now().plusDays(daysAhead);
        return batchRepository.findExpiringBatches(expiryDate).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProductBatchDTO createBatch(CreateBatchRequest request) {
        // Validate product exists
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        // Check if batch number already exists
        if (batchRepository.existsByBatchNumber(request.getBatchNumber())) {
            throw new IllegalArgumentException("Batch number already exists: " + request.getBatchNumber());
        }

        // Validate dates
        if (request.getExpiryDate() != null && request.getManufactureDate() != null) {
            if (request.getExpiryDate().isBefore(request.getManufactureDate())) {
                throw new IllegalArgumentException("Expiry date cannot be before manufacture date");
            }
        }

        ProductBatch batch = new ProductBatch();
        batch.setProduct(product);
        batch.setBatchNumber(request.getBatchNumber());
        batch.setManufactureDate(request.getManufactureDate());
        batch.setExpiryDate(request.getExpiryDate());
        batch.setQuantity(request.getQuantity());
        batch.setStatus(ProductBatch.BatchStatus.ACTIVE);
        batch.setNotes(request.getNotes());

        ProductBatch savedBatch = batchRepository.save(batch);
        log.info("Created batch: {} for product: {}", savedBatch.getBatchNumber(), product.getName());

        return convertToDTO(savedBatch);
    }

    @Transactional
    public ProductBatchDTO updateBatch(UUID id, CreateBatchRequest request) {
        ProductBatch batch = batchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + id));

        // Check if batch number is being changed and if it already exists
        if (!batch.getBatchNumber().equals(request.getBatchNumber())) {
            if (batchRepository.existsByBatchNumber(request.getBatchNumber())) {
                throw new IllegalArgumentException("Batch number already exists: " + request.getBatchNumber());
            }
            batch.setBatchNumber(request.getBatchNumber());
        }

        // Validate dates
        if (request.getExpiryDate() != null && request.getManufactureDate() != null) {
            if (request.getExpiryDate().isBefore(request.getManufactureDate())) {
                throw new IllegalArgumentException("Expiry date cannot be before manufacture date");
            }
        }

        batch.setManufactureDate(request.getManufactureDate());
        batch.setExpiryDate(request.getExpiryDate());
        batch.setQuantity(request.getQuantity());
        batch.setNotes(request.getNotes());

        ProductBatch updatedBatch = batchRepository.save(batch);
        log.info("Updated batch: {}", updatedBatch.getBatchNumber());

        return convertToDTO(updatedBatch);
    }

    @Transactional
    public void updateBatchQuantity(UUID batchId, int quantityChange) {
        ProductBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + batchId));

        int newQuantity = batch.getQuantity() + quantityChange;
        if (newQuantity < 0) {
            throw new IllegalArgumentException("Insufficient quantity in batch: " + batch.getBatchNumber());
        }

        batch.setQuantity(newQuantity);
        batchRepository.save(batch);
        log.info("Updated batch {} quantity by {}, new quantity: {}", batch.getBatchNumber(), quantityChange, newQuantity);
    }

    @Transactional
    public void updateBatchStatus(UUID id, ProductBatch.BatchStatus status) {
        ProductBatch batch = batchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + id));

        batch.setStatus(status);
        batchRepository.save(batch);
        log.info("Updated batch {} status to: {}", batch.getBatchNumber(), status);
    }

    @Transactional
    public void deleteBatch(UUID id) {
        ProductBatch batch = batchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + id));

        if (batch.getQuantity() > 0) {
            throw new IllegalStateException("Cannot delete batch with remaining quantity");
        }

        batchRepository.delete(batch);
        log.info("Deleted batch: {}", batch.getBatchNumber());
    }

    @Transactional
    public void markExpiredBatches() {
        List<ProductBatch> expiredBatches = batchRepository.findExpiredBatches(LocalDate.now());
        for (ProductBatch batch : expiredBatches) {
            batch.setStatus(ProductBatch.BatchStatus.EXPIRED);
            batchRepository.save(batch);
            log.info("Marked batch {} as expired", batch.getBatchNumber());
        }
    }

    private ProductBatchDTO convertToDTO(ProductBatch batch) {
        ProductBatchDTO dto = new ProductBatchDTO();
        dto.setId(batch.getId());
        dto.setProductId(batch.getProduct().getId());
        dto.setProductName(batch.getProduct().getName());
        dto.setProductSku(batch.getProduct().getSku());
        dto.setBatchNumber(batch.getBatchNumber());
        dto.setManufactureDate(batch.getManufactureDate());
        dto.setExpiryDate(batch.getExpiryDate());
        dto.setQuantity(batch.getQuantity());
        dto.setStatus(batch.getStatus());
        dto.setNotes(batch.getNotes());
        dto.setCreatedAt(batch.getCreatedAt());
        dto.setUpdatedAt(batch.getUpdatedAt());
        return dto;
    }
}
