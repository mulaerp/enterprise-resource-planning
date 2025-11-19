package com.mulaerp.purchase.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.purchase.dto.CreatePurchaseOrderRequest;
import com.mulaerp.purchase.dto.PurchaseOrderDTO;
import com.mulaerp.purchase.dto.PurchaseOrderItemDTO;
import com.mulaerp.purchase.entity.PurchaseOrder;
import com.mulaerp.purchase.entity.PurchaseOrderItem;
import com.mulaerp.purchase.repository.PurchaseOrderRepository;
import com.mulaerp.supplier.entity.Supplier;
import com.mulaerp.supplier.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    @Cacheable(value = "purchaseOrders", key = "#pageable.pageNumber + '-' + #pageable.pageSize")
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
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase order not found"));

        po.setStatus(status);

        if (status == PurchaseOrder.PurchaseOrderStatus.RECEIVED) {
            for (PurchaseOrderItem item : po.getItems()) {
                Product product = item.getProduct();
                product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
                item.setReceivedQuantity(item.getQuantity());
                productRepository.save(product);
            }
        }

        PurchaseOrder updated = purchaseOrderRepository.save(po);
        return convertToDTO(updated);
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

    private String generatePoNumber() {
        String prefix = "PO-" + LocalDate.now().getYear() + "-";
        long count = purchaseOrderRepository.count() + 1;
        return prefix + String.format("%06d", count);
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
            return itemDTO;
        }).collect(Collectors.toList()));

        return dto;
    }
}
