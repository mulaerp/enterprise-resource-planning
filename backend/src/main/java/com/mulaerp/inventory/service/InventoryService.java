package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.StockAdjustmentDTO;
import com.mulaerp.inventory.entity.StockAdjustment;
import com.mulaerp.inventory.repository.StockAdjustmentRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class InventoryService {

    private final StockAdjustmentRepository stockAdjustmentRepository;
    private final ProductRepository productRepository;

    public List<StockAdjustmentDTO> getAllAdjustments() {
        return stockAdjustmentRepository.findByDeletedFalse().stream()
            .map(StockAdjustmentDTO::fromEntity)
            .collect(Collectors.toList());
    }

    public StockAdjustmentDTO getAdjustmentById(UUID id) {
        StockAdjustment adjustment = stockAdjustmentRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Stock adjustment not found"));
        return StockAdjustmentDTO.fromEntity(adjustment);
    }

    public StockAdjustmentDTO createAdjustment(StockAdjustmentDTO dto) {
        Product product = productRepository.findById(dto.getProductId())
            .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        StockAdjustment adjustment = new StockAdjustment();
        adjustment.setAdjustmentNumber(generateAdjustmentNumber());
        adjustment.setProduct(product);
        adjustment.setWarehouseId(dto.getWarehouseId());
        adjustment.setAdjustmentType(dto.getAdjustmentType());
        adjustment.setQuantityBefore(product.getStockQuantity());
        adjustment.setQuantityAdjusted(dto.getQuantityAdjusted());
        
        // Calculate new quantity
        int newQuantity = product.getStockQuantity();
        if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.INCREASE) {
            newQuantity += dto.getQuantityAdjusted();
        } else if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.DECREASE) {
            newQuantity -= dto.getQuantityAdjusted();
        } else if (dto.getAdjustmentType() == StockAdjustment.AdjustmentType.RECOUNT) {
            newQuantity = dto.getQuantityAdjusted();
        }
        
        adjustment.setQuantityAfter(newQuantity);
        adjustment.setReason(dto.getReason());
        adjustment.setNotes(dto.getNotes());
        adjustment.setAdjustmentDate(dto.getAdjustmentDate() != null ? dto.getAdjustmentDate() : LocalDate.now());
        adjustment.setApprovedBy(dto.getApprovedBy());

        // Update product stock
        product.setStockQuantity(newQuantity);
        productRepository.save(product);

        adjustment = stockAdjustmentRepository.save(adjustment);
        return StockAdjustmentDTO.fromEntity(adjustment);
    }

    public void deleteAdjustment(UUID id) {
        StockAdjustment adjustment = stockAdjustmentRepository.findById(id)
            .filter(a -> !a.getDeleted())
            .orElseThrow(() -> new ResourceNotFoundException("Stock adjustment not found"));

        adjustment.setDeleted(true);
        stockAdjustmentRepository.save(adjustment);
    }

    public List<StockAdjustmentDTO> getAdjustmentsByProduct(UUID productId) {
        return stockAdjustmentRepository.findByProductIdAndDeletedFalse(productId).stream()
            .map(StockAdjustmentDTO::fromEntity)
            .collect(Collectors.toList());
    }

    private String generateAdjustmentNumber() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "ADJ-" + timestamp;
    }
}
