package com.mulaerp.purchase.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.CreateBatchRequest;
import com.mulaerp.inventory.dto.CreateSerialRequest;
import com.mulaerp.inventory.dto.ProductBatchDTO;
import com.mulaerp.inventory.dto.ProductSerialDTO;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.service.BatchTrackingService;
import com.mulaerp.inventory.service.SerialTrackingService;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.inventory.util.UuidCsv;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.purchase.dto.CreatePurchaseOrderRequest;
import com.mulaerp.purchase.dto.PurchaseOrderDTO;
import com.mulaerp.purchase.dto.PurchaseOrderItemDTO;
import com.mulaerp.purchase.dto.ReceivePurchaseOrderRequest;
import com.mulaerp.purchase.entity.PurchaseOrder;
import com.mulaerp.purchase.entity.PurchaseOrderItem;
import com.mulaerp.purchase.repository.PurchaseOrderRepository;
import com.mulaerp.supplier.entity.Supplier;
import com.mulaerp.supplier.repository.SupplierRepository;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final BatchTrackingService batchTrackingService;
    private final SerialTrackingService serialTrackingService;
    private final StockMovementService stockMovementService;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;

    // NOTE: intentionally not @Cacheable - RedisCacheManager's Jackson serializer (see
    // CacheConfig) cannot deserialize org.springframework.data.domain.PageImpl (no default
    // constructor/Creator), so caching a Page<> here 500s on every read.
    @Transactional(readOnly = true)
    public Page<PurchaseOrderDTO> getAllPurchaseOrders(Pageable pageable) {
        return purchaseOrderRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "purchaseOrder", key = "#id")
    public PurchaseOrderDTO getPurchaseOrderById(UUID id) {
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found"));
        return convertToDTO(po);
    }

    @Transactional(readOnly = true)
    public Page<PurchaseOrderDTO> searchPurchaseOrders(String search, Pageable pageable) {
        return purchaseOrderRepository.searchPurchaseOrders(search, pageable).map(this::convertToDTO);
    }

    @Transactional
    @CacheEvict(value = {"purchaseOrders", "purchaseOrder"}, allEntries = true)
    public PurchaseOrderDTO createPurchaseOrder(CreatePurchaseOrderRequest request) {
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));

        PurchaseOrder po = new PurchaseOrder();
        po.setPoNumber(generatePoNumber());
        po.setSupplier(supplier);
        po.setOrderDate(request.getOrderDate());
        po.setExpectedDate(request.getExpectedDate());
        po.setStatus(PurchaseOrder.PurchaseOrderStatus.DRAFT);
        po.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        po.setNotes(request.getNotes());

        for (CreatePurchaseOrderRequest.PurchaseOrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setProduct(product);
            item.setQuantity(itemReq.getQuantity());
            item.setUnitPrice(itemReq.getUnitPrice());
            item.setTaxRate(itemReq.getTaxRate() != null ? itemReq.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();

            po.addItem(item);
        }

        po.calculateTotals();
        PurchaseOrder saved = purchaseOrderRepository.save(po);
        return convertToDTO(saved);
    }

    @Transactional
    @CacheEvict(value = {"purchaseOrders", "purchaseOrder"}, allEntries = true)
    public PurchaseOrderDTO updatePurchaseOrder(UUID id, CreatePurchaseOrderRequest request) {
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found"));

        if (po.getStatus() != PurchaseOrder.PurchaseOrderStatus.DRAFT) {
            throw new IllegalStateException("Can only update draft purchase orders");
        }

        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));

        po.setSupplier(supplier);
        po.setOrderDate(request.getOrderDate());
        po.setExpectedDate(request.getExpectedDate());
        po.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        po.setNotes(request.getNotes());

        po.getItems().clear();

        for (CreatePurchaseOrderRequest.PurchaseOrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setProduct(product);
            item.setQuantity(itemReq.getQuantity());
            item.setUnitPrice(itemReq.getUnitPrice());
            item.setTaxRate(itemReq.getTaxRate() != null ? itemReq.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();

            po.addItem(item);
        }

        po.calculateTotals();
        PurchaseOrder updated = purchaseOrderRepository.save(po);
        return convertToDTO(updated);
    }

    @Transactional
    @CacheEvict(value = {"purchaseOrders", "purchaseOrder"}, allEntries = true)
    public PurchaseOrderDTO updateStatus(UUID id, PurchaseOrder.PurchaseOrderStatus status) {
        return updateStatus(id, status, null);
    }

    /**
     * Overload used by the receive flow (WP3) to optionally create/attach a batch and/or
     * register serial numbers per line when the PO transitions to RECEIVED. {@code receiveRequest}
     * is entirely optional - a null request (or one that says nothing about a given item) receives
     * stock exactly as before, with no batch/serial created, so untracked POs are unaffected.
     */
    @Transactional
    @CacheEvict(value = {"purchaseOrders", "purchaseOrder"}, allEntries = true)
    public PurchaseOrderDTO updateStatus(UUID id, PurchaseOrder.PurchaseOrderStatus status,
                                          ReceivePurchaseOrderRequest receiveRequest) {
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found"));

        po.setStatus(status);

        if (status == PurchaseOrder.PurchaseOrderStatus.RECEIVED) {
            Map<UUID, ReceivePurchaseOrderRequest.ItemTracking> trackingByItem =
                    (receiveRequest != null && receiveRequest.getItems() != null)
                            ? receiveRequest.getItems().stream()
                                    .filter(t -> t.getItemId() != null)
                                    .collect(Collectors.toMap(ReceivePurchaseOrderRequest.ItemTracking::getItemId, t -> t))
                            : Collections.emptyMap();

            // PROBLEM 2 fix (silent stock ledger bypass): receiving used to only bump
            // Product.stockQuantity and attribute the movement row to no warehouse (warehouseId
            // null), so warehouse_stock silently fell out of step with the product total. Applied
            // to the default/MAIN warehouse - same resolution PosSaleService/WarehouseService use
            // elsewhere for flows that don't yet support choosing a warehouse explicitly.
            UUID defaultWarehouseId = warehouseService.getDefaultWarehouseId();

            for (PurchaseOrderItem item : po.getItems()) {
                Product product = item.getProduct();
                product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
                item.setReceivedQuantity(item.getQuantity());
                productRepository.save(product);
                warehouseStockService.applyDelta(defaultWarehouseId, product, item.getQuantity());

                // WP7: ledger row in the same transaction as the increment above, now attributed
                // to the default warehouse so it lines up with the warehouse_stock update.
                stockMovementService.recordMovement(product, defaultWarehouseId, StockMovement.MovementType.PO_RECEIPT,
                        item.getQuantity(), po.getPoNumber(), null);

                ReceivePurchaseOrderRequest.ItemTracking tracking = trackingByItem.get(item.getId());
                if (tracking != null) {
                    applyReceiveTracking(item, product, tracking);
                }
            }
        }

        PurchaseOrder updated = purchaseOrderRepository.save(po);
        return convertToDTO(updated);
    }

    private void applyReceiveTracking(PurchaseOrderItem item, Product product,
                                       ReceivePurchaseOrderRequest.ItemTracking tracking) {
        if (tracking.getBatchNumber() != null && !tracking.getBatchNumber().isBlank()) {
            CreateBatchRequest batchRequest = new CreateBatchRequest();
            batchRequest.setProductId(product.getId());
            batchRequest.setBatchNumber(tracking.getBatchNumber().trim());
            batchRequest.setManufactureDate(tracking.getManufactureDate());
            batchRequest.setExpiryDate(tracking.getExpiryDate());
            batchRequest.setQuantity(item.getQuantity());

            ProductBatchDTO batch = batchTrackingService.createBatch(batchRequest);
            item.setBatchId(batch.getId());
            log.info("Created batch {} ({} units) for PO item {}", batch.getBatchNumber(), item.getQuantity(), item.getId());
        }

        List<String> serialNumbers = tracking.getSerialNumbers() == null ? List.of() : tracking.getSerialNumbers().stream()
                .filter(sn -> sn != null && !sn.isBlank())
                .map(String::trim)
                .collect(Collectors.toList());

        if (!serialNumbers.isEmpty()) {
            if (serialNumbers.size() > item.getQuantity()) {
                throw new IllegalArgumentException(String.format(
                        "Cannot register %d serial numbers for PO item %s: received quantity is %d",
                        serialNumbers.size(), item.getId(), item.getQuantity()));
            }

            List<UUID> createdIds = new ArrayList<>();
            for (String serialNumber : serialNumbers) {
                CreateSerialRequest serialRequest = new CreateSerialRequest();
                serialRequest.setProductId(product.getId());
                serialRequest.setSerialNumber(serialNumber);
                ProductSerialDTO serial = serialTrackingService.createSerial(serialRequest);
                createdIds.add(serial.getId());
            }
            item.setSerialIds(UuidCsv.toCsv(createdIds));
            log.info("Registered {} serial(s) for PO item {}", createdIds.size(), item.getId());
        }
    }

    @Transactional
    @CacheEvict(value = {"purchaseOrders", "purchaseOrder"}, allEntries = true)
    public void deletePurchaseOrder(UUID id) {
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found"));

        if (po.getStatus() != PurchaseOrder.PurchaseOrderStatus.DRAFT) {
            throw new IllegalStateException("Can only delete draft purchase orders");
        }

        purchaseOrderRepository.delete(po);
    }

    // count()-based sequence has no locking, so two concurrent PO creations can read the same
    // count and produce the same number - append a random hex suffix so the number is unique by
    // construction even when that race happens.
    private String generatePoNumber() {
        String prefix = "PO-" + LocalDate.now().getYear() + "-";
        long count = purchaseOrderRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }

    private PurchaseOrderDTO convertToDTO(PurchaseOrder po) {
        PurchaseOrderDTO dto = new PurchaseOrderDTO();
        dto.setId(po.getId());
        dto.setPoNumber(po.getPoNumber());
        dto.setSupplierId(po.getSupplier().getId());
        dto.setSupplierName(po.getSupplier().getName());
        dto.setOrderDate(po.getOrderDate());
        dto.setExpectedDate(po.getExpectedDate());
        dto.setStatus(po.getStatus());
        dto.setSubtotal(po.getSubtotal());
        dto.setTax(po.getTax());
        dto.setTotal(po.getTotal());
        dto.setNotes(po.getNotes());
        dto.setCreatedAt(po.getCreatedAt());
        dto.setUpdatedAt(po.getUpdatedAt());

        dto.setItems(po.getItems().stream().map(item -> {
            PurchaseOrderItemDTO itemDTO = new PurchaseOrderItemDTO();
            itemDTO.setId(item.getId());
            itemDTO.setProductId(item.getProduct().getId());
            itemDTO.setProductName(item.getProduct().getName());
            itemDTO.setProductSku(item.getProduct().getSku());
            itemDTO.setQuantity(item.getQuantity());
            itemDTO.setUnitPrice(item.getUnitPrice());
            itemDTO.setTaxRate(item.getTaxRate());
            itemDTO.setTotal(item.getTotal());
            itemDTO.setReceivedQuantity(item.getReceivedQuantity());
            itemDTO.setBatchId(item.getBatchId());
            itemDTO.setSerialIds(UuidCsv.fromCsv(item.getSerialIds()));
            return itemDTO;
        }).collect(Collectors.toList()));

        return dto;
    }
}
