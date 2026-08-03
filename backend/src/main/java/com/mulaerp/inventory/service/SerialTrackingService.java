package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.inventory.dto.CreateSerialRequest;
import com.mulaerp.inventory.dto.ProductSerialDTO;
import com.mulaerp.inventory.entity.ProductSerial;
import com.mulaerp.inventory.repository.ProductSerialRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.sales.entity.SalesOrder;
import com.mulaerp.sales.repository.SalesOrderRepository;
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
public class SerialTrackingService {

    private final ProductSerialRepository serialRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final SalesOrderRepository salesOrderRepository;

    @Transactional(readOnly = true)
    public List<ProductSerialDTO> getAllSerials() {
        return serialRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductSerialDTO getSerialById(UUID id) {
        ProductSerial serial = serialRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + id));
        return convertToDTO(serial);
    }

    @Transactional(readOnly = true)
    public ProductSerialDTO getSerialByNumber(String serialNumber) {
        ProductSerial serial = serialRepository.findBySerialNumber(serialNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Serial not found with number: " + serialNumber));
        return convertToDTO(serial);
    }

    @Transactional(readOnly = true)
    public List<ProductSerialDTO> getSerialsByProduct(UUID productId) {
        return serialRepository.findByProductId(productId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductSerialDTO> getAvailableSerialsByProduct(UUID productId) {
        return serialRepository.findByProductIdAndStatus(productId, ProductSerial.SerialStatus.IN_STOCK).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductSerialDTO> getSerialsByCustomer(UUID customerId) {
        return serialRepository.findByCustomerId(customerId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductSerialDTO> getWarrantyExpiring(int daysAhead) {
        LocalDate expiryDate = LocalDate.now().plusDays(daysAhead);
        return serialRepository.findWarrantyExpiring(expiryDate).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProductSerialDTO createSerial(CreateSerialRequest request) {
        // Validate product exists
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + request.getProductId()));

        // Check if serial number already exists
        if (serialRepository.existsBySerialNumber(request.getSerialNumber())) {
            throw new IllegalArgumentException("Serial number already exists: " + request.getSerialNumber());
        }

        // Validate dates
        if (request.getWarrantyExpiryDate() != null && request.getPurchaseDate() != null) {
            if (request.getWarrantyExpiryDate().isBefore(request.getPurchaseDate())) {
                throw new IllegalArgumentException("Warranty expiry date cannot be before purchase date");
            }
        }

        ProductSerial serial = new ProductSerial();
        serial.setProduct(product);
        serial.setSerialNumber(request.getSerialNumber());
        serial.setPurchaseDate(request.getPurchaseDate());
        serial.setWarrantyExpiryDate(request.getWarrantyExpiryDate());
        serial.setStatus(ProductSerial.SerialStatus.IN_STOCK);
        serial.setWarehouseId(request.getWarehouseId());
        serial.setNotes(request.getNotes());

        ProductSerial savedSerial = serialRepository.save(serial);
        log.info("Created serial: {} for product: {}", savedSerial.getSerialNumber(), product.getName());

        return convertToDTO(savedSerial);
    }

    @Transactional
    public ProductSerialDTO updateSerial(UUID id, CreateSerialRequest request) {
        ProductSerial serial = serialRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + id));

        // Check if serial number is being changed and if it already exists
        if (!serial.getSerialNumber().equals(request.getSerialNumber())) {
            if (serialRepository.existsBySerialNumber(request.getSerialNumber())) {
                throw new IllegalArgumentException("Serial number already exists: " + request.getSerialNumber());
            }
            serial.setSerialNumber(request.getSerialNumber());
        }

        // Validate dates
        if (request.getWarrantyExpiryDate() != null && request.getPurchaseDate() != null) {
            if (request.getWarrantyExpiryDate().isBefore(request.getPurchaseDate())) {
                throw new IllegalArgumentException("Warranty expiry date cannot be before purchase date");
            }
        }

        serial.setPurchaseDate(request.getPurchaseDate());
        serial.setWarrantyExpiryDate(request.getWarrantyExpiryDate());
        serial.setWarehouseId(request.getWarehouseId());
        serial.setNotes(request.getNotes());

        ProductSerial updatedSerial = serialRepository.save(serial);
        log.info("Updated serial: {}", updatedSerial.getSerialNumber());

        return convertToDTO(updatedSerial);
    }

    @Transactional
    public void updateSerialStatus(UUID id, ProductSerial.SerialStatus status) {
        ProductSerial serial = serialRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + id));

        serial.setStatus(status);
        serialRepository.save(serial);
        log.info("Updated serial {} status to: {}", serial.getSerialNumber(), status);
    }

    @Transactional
    public void markSerialAsSold(UUID serialId, UUID customerId, UUID salesOrderId) {
        ProductSerial serial = serialRepository.findById(serialId)
                .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + serialId));

        if (serial.getStatus() != ProductSerial.SerialStatus.IN_STOCK) {
            throw new IllegalStateException("Serial is not available for sale");
        }

        serial.setStatus(ProductSerial.SerialStatus.SOLD);
        serial.setCustomerId(customerId);
        serial.setSalesOrderId(salesOrderId);
        serialRepository.save(serial);
        log.info("Marked serial {} as sold to customer: {}", serial.getSerialNumber(), customerId);
    }

    @Transactional
    public void deleteSerial(UUID id) {
        ProductSerial serial = serialRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + id));

        if (serial.getStatus() == ProductSerial.SerialStatus.SOLD) {
            throw new IllegalStateException("Cannot delete sold serial number");
        }

        serialRepository.delete(serial);
        log.info("Deleted serial: {}", serial.getSerialNumber());
    }

    private ProductSerialDTO convertToDTO(ProductSerial serial) {
        ProductSerialDTO dto = new ProductSerialDTO();
        dto.setId(serial.getId());
        dto.setProductId(serial.getProduct().getId());
        dto.setProductName(serial.getProduct().getName());
        dto.setProductSku(serial.getProduct().getSku());
        dto.setSerialNumber(serial.getSerialNumber());
        dto.setPurchaseDate(serial.getPurchaseDate());
        dto.setWarrantyExpiryDate(serial.getWarrantyExpiryDate());
        dto.setStatus(serial.getStatus());
        dto.setCustomerId(serial.getCustomerId());
        dto.setSalesOrderId(serial.getSalesOrderId());
        dto.setWarehouseId(serial.getWarehouseId());
        dto.setNotes(serial.getNotes());
        dto.setCreatedAt(serial.getCreatedAt());
        dto.setUpdatedAt(serial.getUpdatedAt());

        // Fetch customer name if available
        if (serial.getCustomerId() != null) {
            customerRepository.findById(serial.getCustomerId())
                    .ifPresent(customer -> dto.setCustomerName(customer.getName()));
        }

        // Fetch sales order number if available. SalesOrderRepository's id type is UUID
        // (matching SalesOrder's @Id) - previously called with .toString() here, which
        // mismatched the entity's actual id type and would fail at query time (WP3 fix).
        if (serial.getSalesOrderId() != null) {
            salesOrderRepository.findById(serial.getSalesOrderId())
                    .ifPresent(order -> dto.setSalesOrderNumber(order.getOrderNumber()));
        }

        return dto;
    }
}
