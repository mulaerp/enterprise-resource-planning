package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.CreateStockTransferRequest;
import com.mulaerp.inventory.dto.StockTransferDTO;
import com.mulaerp.inventory.dto.StockTransferItemDTO;
import com.mulaerp.inventory.entity.ProductBatch;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.entity.StockTransfer;
import com.mulaerp.inventory.entity.StockTransferItem;
import com.mulaerp.inventory.repository.ProductBatchRepository;
import com.mulaerp.inventory.repository.StockTransferItemRepository;
import com.mulaerp.inventory.repository.StockTransferRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.warehouse.service.WarehouseStockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StockTransferService {

    private final StockTransferRepository transferRepository;
    private final StockTransferItemRepository transferItemRepository;
    private final ProductRepository productRepository;
    private final ProductBatchRepository batchRepository;
    private final WarehouseStockService warehouseStockService;
    private final StockMovementService stockMovementService;

    @Transactional(readOnly = true)
    public List<StockTransferDTO> getAllTransfers() {
        return transferRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public StockTransferDTO getTransferById(UUID id) {
        StockTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with id: " + id));
        return convertToDTO(transfer);
    }

    @Transactional(readOnly = true)
    public StockTransferDTO getTransferByNumber(String transferNumber) {
        StockTransfer transfer = transferRepository.findByTransferNumber(transferNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with number: " + transferNumber));
        return convertToDTO(transfer);
    }

    @Transactional(readOnly = true)
    public List<StockTransferDTO> getTransfersByStatus(StockTransfer.TransferStatus status) {
        return transferRepository.findByStatus(status).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StockTransferDTO> getTransfersByWarehouse(UUID warehouseId) {
        return transferRepository.findByWarehouseId(warehouseId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public StockTransferDTO createTransfer(CreateStockTransferRequest request) {
        // Validate warehouses are different
        if (request.getFromWarehouseId().equals(request.getToWarehouseId())) {
            throw new IllegalArgumentException("From and To warehouses must be different");
        }

        // Generate transfer number
        String transferNumber = generateTransferNumber();

        StockTransfer transfer = new StockTransfer();
        transfer.setTransferNumber(transferNumber);
        transfer.setFromWarehouseId(request.getFromWarehouseId());
        transfer.setToWarehouseId(request.getToWarehouseId());
        transfer.setTransferDate(request.getTransferDate());
        transfer.setStatus(StockTransfer.TransferStatus.PENDING);
        transfer.setNotes(request.getNotes());

        // Add items
        for (CreateStockTransferRequest.TransferItemRequest itemRequest : request.getItems()) {
            Product product = productRepository.findById(itemRequest.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + itemRequest.getProductId()));

            ProductBatch batch = null;
            if (itemRequest.getBatchId() != null) {
                batch = batchRepository.findById(itemRequest.getBatchId())
                        .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + itemRequest.getBatchId()));
            }

            StockTransferItem item = new StockTransferItem();
            item.setProduct(product);
            item.setBatch(batch);
            item.setQuantity(itemRequest.getQuantity());
            transfer.addItem(item);
        }

        StockTransfer savedTransfer = transferRepository.save(transfer);
        log.info("Created stock transfer: {}", savedTransfer.getTransferNumber());

        return convertToDTO(savedTransfer);
    }

    @Transactional
    public StockTransferDTO updateTransfer(UUID id, CreateStockTransferRequest request) {
        StockTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with id: " + id));

        if (transfer.getStatus() != StockTransfer.TransferStatus.PENDING) {
            throw new IllegalStateException("Can only update pending transfers");
        }

        // Validate warehouses are different
        if (request.getFromWarehouseId().equals(request.getToWarehouseId())) {
            throw new IllegalArgumentException("From and To warehouses must be different");
        }

        transfer.setFromWarehouseId(request.getFromWarehouseId());
        transfer.setToWarehouseId(request.getToWarehouseId());
        transfer.setTransferDate(request.getTransferDate());
        transfer.setNotes(request.getNotes());

        // Clear existing items
        transfer.getItems().clear();

        // Add new items
        for (CreateStockTransferRequest.TransferItemRequest itemRequest : request.getItems()) {
            Product product = productRepository.findById(itemRequest.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + itemRequest.getProductId()));

            ProductBatch batch = null;
            if (itemRequest.getBatchId() != null) {
                batch = batchRepository.findById(itemRequest.getBatchId())
                        .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + itemRequest.getBatchId()));
            }

            StockTransferItem item = new StockTransferItem();
            item.setProduct(product);
            item.setBatch(batch);
            item.setQuantity(itemRequest.getQuantity());
            transfer.addItem(item);
        }

        StockTransfer updatedTransfer = transferRepository.save(transfer);
        log.info("Updated stock transfer: {}", updatedTransfer.getTransferNumber());

        return convertToDTO(updatedTransfer);
    }

    @Transactional
    public void updateTransferStatus(UUID id, StockTransfer.TransferStatus status) {
        StockTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with id: " + id));

        // Validate status transition
        validateStatusTransition(transfer.getStatus(), status);

        transfer.setStatus(status);
        transferRepository.save(transfer);
        log.info("Updated transfer {} status to: {}", transfer.getTransferNumber(), status);
    }

    @Transactional
    public void completeTransfer(UUID id) {
        StockTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with id: " + id));

        if (transfer.getStatus() != StockTransfer.TransferStatus.IN_TRANSIT) {
            throw new IllegalStateException("Can only complete transfers that are in transit");
        }

        // decrementValidated() throws IllegalArgumentException the moment any item's source
        // warehouse lacks sufficient stock; since this whole method is @Transactional, that
        // exception rolls back everything already applied in this loop, so a multi-item
        // transfer either moves stock for every item or for none of them.
        //
        // Stock model: Product.stockQuantity is the TOTAL quantity across every warehouse; a
        // transfer only moves stock between warehouses, so the total is unchanged and
        // Product.stockQuantity is intentionally left untouched here. Only the per-warehouse
        // warehouse_stock rows move (decrement source, increment/upsert destination). This
        // mirrors how StockAdjustmentService treats Product.stockQuantity as the authoritative
        // total while warehouse_stock tracks the breakdown.
        for (StockTransferItem item : transfer.getItems()) {
            Product product = item.getProduct();
            warehouseStockService.decrementValidated(transfer.getFromWarehouseId(), product, item.getQuantity());
            warehouseStockService.applyDelta(transfer.getToWarehouseId(), product, item.getQuantity());

            // WP7: one TRANSFER_OUT + one TRANSFER_IN ledger row per item, same transaction as
            // the warehouse_stock moves above. Product.stockQuantity (the total) is unaffected by
            // a transfer, so quantityAfter on both rows is simply the current, unchanged total.
            stockMovementService.recordMovement(product, transfer.getFromWarehouseId(),
                    StockMovement.MovementType.TRANSFER_OUT, -item.getQuantity(),
                    transfer.getTransferNumber(), transfer.getNotes());
            stockMovementService.recordMovement(product, transfer.getToWarehouseId(),
                    StockMovement.MovementType.TRANSFER_IN, item.getQuantity(),
                    transfer.getTransferNumber(), transfer.getNotes());
        }

        transfer.setStatus(StockTransfer.TransferStatus.COMPLETED);
        transferRepository.save(transfer);
        log.info("Completed stock transfer: {}", transfer.getTransferNumber());
    }

    @Transactional
    public void cancelTransfer(UUID id) {
        StockTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with id: " + id));

        if (transfer.getStatus() == StockTransfer.TransferStatus.COMPLETED) {
            throw new IllegalStateException("Cannot cancel completed transfers");
        }

        transfer.setStatus(StockTransfer.TransferStatus.CANCELLED);
        transferRepository.save(transfer);
        log.info("Cancelled stock transfer: {}", transfer.getTransferNumber());
    }

    @Transactional
    public void deleteTransfer(UUID id) {
        StockTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock transfer not found with id: " + id));

        if (transfer.getStatus() != StockTransfer.TransferStatus.PENDING && 
            transfer.getStatus() != StockTransfer.TransferStatus.CANCELLED) {
            throw new IllegalStateException("Can only delete pending or cancelled transfers");
        }

        transferRepository.delete(transfer);
        log.info("Deleted stock transfer: {}", transfer.getTransferNumber());
    }

    private void validateStatusTransition(StockTransfer.TransferStatus currentStatus, StockTransfer.TransferStatus newStatus) {
        if (currentStatus == StockTransfer.TransferStatus.COMPLETED) {
            throw new IllegalStateException("Cannot change status of completed transfer");
        }
        if (currentStatus == StockTransfer.TransferStatus.CANCELLED) {
            throw new IllegalStateException("Cannot change status of cancelled transfer");
        }
    }

    // Millisecond timestamp narrows the collision window vs. second-precision generators
    // elsewhere, but concurrent callers can still land on the same millisecond - append a random
    // hex suffix so the number is unique by construction (same fix as
    // InventoryService#generateAdjustmentNumber / SalesOrderService#generateOrderNumber).
    private String generateTransferNumber() {
        String prefix = "TRF";
        String timestamp = String.valueOf(System.currentTimeMillis());
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + "-" + timestamp.substring(timestamp.length() - 10) + "-" + suffix;
    }

    private StockTransferDTO convertToDTO(StockTransfer transfer) {
        StockTransferDTO dto = new StockTransferDTO();
        dto.setId(transfer.getId());
        dto.setTransferNumber(transfer.getTransferNumber());
        dto.setFromWarehouseId(transfer.getFromWarehouseId());
        dto.setFromWarehouseName("Warehouse " + transfer.getFromWarehouseId().toString().substring(0, 8));
        dto.setToWarehouseId(transfer.getToWarehouseId());
        dto.setToWarehouseName("Warehouse " + transfer.getToWarehouseId().toString().substring(0, 8));
        dto.setTransferDate(transfer.getTransferDate());
        dto.setStatus(transfer.getStatus());
        dto.setNotes(transfer.getNotes());
        dto.setCreatedAt(transfer.getCreatedAt());
        dto.setUpdatedAt(transfer.getUpdatedAt());

        // Convert items
        List<StockTransferItemDTO> itemDTOs = transfer.getItems().stream()
                .map(this::convertItemToDTO)
                .collect(Collectors.toList());
        dto.setItems(itemDTOs);

        return dto;
    }

    private StockTransferItemDTO convertItemToDTO(StockTransferItem item) {
        StockTransferItemDTO dto = new StockTransferItemDTO();
        dto.setId(item.getId());
        dto.setProductId(item.getProduct().getId());
        dto.setProductName(item.getProduct().getName());
        dto.setProductSku(item.getProduct().getSku());
        if (item.getBatch() != null) {
            dto.setBatchId(item.getBatch().getId());
            dto.setBatchNumber(item.getBatch().getBatchNumber());
        }
        dto.setQuantity(item.getQuantity());
        return dto;
    }
}
