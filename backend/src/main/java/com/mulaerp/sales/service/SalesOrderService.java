package com.mulaerp.sales.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.common.service.NonBlockingHookExecutor;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.email.service.EmailTemplateService;
import com.mulaerp.inventory.entity.ProductBatch;
import com.mulaerp.inventory.entity.ProductSerial;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.repository.ProductBatchRepository;
import com.mulaerp.inventory.repository.ProductSerialRepository;
import com.mulaerp.inventory.service.BatchTrackingService;
import com.mulaerp.inventory.service.SerialTrackingService;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.inventory.util.UuidCsv;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.sales.dto.CreateSalesOrderRequest;
import com.mulaerp.sales.dto.SalesOrderDto;
import com.mulaerp.sales.dto.UpdateSalesOrderRequest;
import com.mulaerp.sales.entity.SalesOrder;
import com.mulaerp.sales.entity.SalesOrderItem;
import com.mulaerp.sales.repository.SalesOrderRepository;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warranty.service.WarrantyService;
import com.mulaerp.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class SalesOrderService {

    private final SalesOrderRepository salesOrderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final WebSocketService webSocketService;
    private final EmailTemplateService emailTemplateService;
    private final ProductBatchRepository productBatchRepository;
    private final ProductSerialRepository productSerialRepository;
    private final BatchTrackingService batchTrackingService;
    private final SerialTrackingService serialTrackingService;
    private final StockMovementService stockMovementService;
    private final WarehouseService warehouseService;
    private final WarrantyService warrantyService;
    private final NonBlockingHookExecutor nonBlockingHookExecutor;

    @Value("${mulaerp.mail.admin-recipient:admin@mulaerp.com}")
    private String adminRecipient;

    @Transactional(readOnly = true)
    public Page<SalesOrderDto> getAllSalesOrders(String search, Pageable pageable) {
        Page<SalesOrder> orders;
        if (search != null && !search.trim().isEmpty()) {
            orders = salesOrderRepository.searchSalesOrders(search, pageable);
        } else {
            orders = salesOrderRepository.findAll(pageable);
        }
        return orders.map(SalesOrderDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public SalesOrderDto getSalesOrderById(UUID id) {
        SalesOrder order = salesOrderRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales order not found with id: " + id));
        return SalesOrderDto.fromEntity(order);
    }

    @Transactional
    public SalesOrderDto createSalesOrder(CreateSalesOrderRequest request) {
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found with id: " + request.getCustomerId()));

        SalesOrder order = new SalesOrder();
        order.setOrderNumber(generateOrderNumber());
        order.setCustomer(customer);
        order.setOrderDate(request.getOrderDate());
        order.setDeliveryDate(request.getDeliveryDate());
        order.setStatus(SalesOrder.OrderStatus.DRAFT);
        order.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        order.setNotes(request.getNotes());

        // Add items
        for (CreateSalesOrderRequest.CreateSalesOrderItemRequest itemRequest : request.getItems()) {
            Product product = productRepository.findById(itemRequest.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + itemRequest.getProductId()));

            SalesOrderItem item = new SalesOrderItem();
            item.setProduct(product);
            item.setQuantity(itemRequest.getQuantity());
            item.setUnitPrice(itemRequest.getUnitPrice());
            item.setDiscount(itemRequest.getDiscount() != null ? itemRequest.getDiscount() : BigDecimal.ZERO);
            item.setTaxRate(itemRequest.getTaxRate() != null ? itemRequest.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();
            applyItemTracking(item, product, itemRequest);

            order.addItem(item);
        }

        order.calculateTotals();
        SalesOrder savedOrder = salesOrderRepository.save(order);

        // Send WebSocket notification (Phase 6.7)
        webSocketService.notifyNewOrder(SalesOrderDto.fromEntity(savedOrder));

        return SalesOrderDto.fromEntity(savedOrder);
    }

    @Transactional
    public SalesOrderDto updateSalesOrder(UUID id, UpdateSalesOrderRequest request) {
        SalesOrder order = salesOrderRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales order not found with id: " + id));

        if (order.getStatus() != SalesOrder.OrderStatus.DRAFT) {
            throw new IllegalStateException("Only draft orders can be updated");
        }

        order.setDeliveryDate(request.getDeliveryDate());
        order.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        order.setNotes(request.getNotes());

        // Clear existing items
        order.getItems().clear();

        // Add new items
        for (CreateSalesOrderRequest.CreateSalesOrderItemRequest itemRequest : request.getItems()) {
            Product product = productRepository.findById(itemRequest.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + itemRequest.getProductId()));

            SalesOrderItem item = new SalesOrderItem();
            item.setProduct(product);
            item.setQuantity(itemRequest.getQuantity());
            item.setUnitPrice(itemRequest.getUnitPrice());
            item.setDiscount(itemRequest.getDiscount() != null ? itemRequest.getDiscount() : BigDecimal.ZERO);
            item.setTaxRate(itemRequest.getTaxRate() != null ? itemRequest.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();
            applyItemTracking(item, product, itemRequest);

            order.addItem(item);
        }

        order.calculateTotals();
        SalesOrder updatedOrder = salesOrderRepository.save(order);
        return SalesOrderDto.fromEntity(updatedOrder);
    }

    /**
     * WP3: validates + attaches the optional batch/serial selection on a SO line. Both are
     * optional - an item request with neither set behaves exactly as before (item.batchId and
     * item.serialIds stay null). Only existence/product-match/status is checked here; the
     * authoritative sufficiency check + actual decrement happens on delivery (see
     * {@link #fulfillTrackedItems}), since quantities can move between order creation and delivery.
     */
    private void applyItemTracking(SalesOrderItem item, Product product,
                                    CreateSalesOrderRequest.CreateSalesOrderItemRequest itemRequest) {
        if (itemRequest.getBatchId() != null) {
            ProductBatch batch = productBatchRepository.findById(itemRequest.getBatchId())
                    .orElseThrow(() -> new ResourceNotFoundException("Batch not found with id: " + itemRequest.getBatchId()));
            if (!batch.getProduct().getId().equals(product.getId())) {
                throw new IllegalArgumentException("Batch " + batch.getBatchNumber() + " does not belong to product " + product.getSku());
            }
            if (batch.getQuantity() < item.getQuantity()) {
                throw new IllegalArgumentException(String.format(
                        "Insufficient quantity in batch %s: available %d, requested %d",
                        batch.getBatchNumber(), batch.getQuantity(), item.getQuantity()));
            }
            item.setBatchId(batch.getId());
        }

        if (itemRequest.getSerialIds() != null && !itemRequest.getSerialIds().isEmpty()) {
            List<UUID> serialIds = itemRequest.getSerialIds();
            if (serialIds.size() > item.getQuantity()) {
                throw new IllegalArgumentException(String.format(
                        "Cannot select %d serial numbers for a line quantity of %d", serialIds.size(), item.getQuantity()));
            }
            for (UUID serialId : serialIds) {
                ProductSerial serial = productSerialRepository.findById(serialId)
                        .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + serialId));
                if (!serial.getProduct().getId().equals(product.getId())) {
                    throw new IllegalArgumentException("Serial " + serial.getSerialNumber() + " does not belong to product " + product.getSku());
                }
                if (serial.getStatus() != ProductSerial.SerialStatus.IN_STOCK) {
                    throw new IllegalArgumentException("Serial " + serial.getSerialNumber() + " is not available (status: " + serial.getStatus() + ")");
                }
            }
            item.setSerialIds(UuidCsv.toCsv(serialIds));
        }
    }

    /**
     * WP3: runs when a SO transitions into DELIVERED - the sales-side "fulfilment" point mirrored
     * from how PosSaleService/InventoryService validate-then-decrement stock. Decrements each
     * tracked batch by the line quantity (rejecting the whole transition if any batch no longer has
     * enough, e.g. it was drawn down elsewhere since the order was created) and marks each tracked
     * serial SOLD against this order's customer. Lines without any tracking are untouched, so
     * orders created before WP3 (or that simply never used tracking) deliver exactly as before.
     */
    private void fulfillTrackedItems(SalesOrder order) {
        UUID customerId = order.getCustomer() != null ? order.getCustomer().getId() : null;
        for (SalesOrderItem item : order.getItems()) {
            if (item.getBatchId() != null) {
                batchTrackingService.updateBatchQuantity(item.getBatchId(), -item.getQuantity());

                // WP7: SO delivery never decrements Product.stockQuantity (confirmed - only the
                // batch's own quantity moves, see BatchTrackingService#updateBatchQuantity above),
                // so this is the only point where an actual quantity change happens on delivery.
                // quantityAfter reflects Product.stockQuantity, which this movement doesn't
                // change - recorded as-is for context, not implying the total moved.
                //
                // PROBLEM 2 fix: warehouseId is now attributed to the default/MAIN warehouse
                // (previously null) purely for reporting/traceability - batches aren't tied to a
                // specific warehouse in this schema and this movement still doesn't touch
                // warehouse_stock, so there is nothing here that could fall out of step with
                // Product.stockQuantity (neither moves at this point).
                stockMovementService.recordMovement(item.getProduct(), warehouseService.getDefaultWarehouseId(),
                        StockMovement.MovementType.SO_DELIVERY, -item.getQuantity(), order.getOrderNumber(),
                        "batch " + item.getBatchId());
            }

            List<UUID> serialIds = UuidCsv.fromCsv(item.getSerialIds());
            for (UUID serialId : serialIds) {
                ProductSerial serial = productSerialRepository.findById(serialId)
                        .orElseThrow(() -> new ResourceNotFoundException("Serial not found with id: " + serialId));
                if (serial.getStatus() != ProductSerial.SerialStatus.IN_STOCK) {
                    throw new IllegalStateException("Serial " + serial.getSerialNumber() + " is no longer available (status: " + serial.getStatus() + ")");
                }
                serialTrackingService.markSerialAsSold(serialId, customerId, order.getId());

                // REPAIR/WARRANTY: non-blocking auto-issue, one warranty per delivered serial
                // whose product has warrantyMonths set - never fails the delivery (same pattern
                // as the email/journal hooks elsewhere in this codebase).
                try {
                    // CRITICAL FIX 3: REQUIRES_NEW via NonBlockingHookExecutor - a failure here
                    // rolls back only this hook's own transaction, never the SO delivery.
                    nonBlockingHookExecutor.runInNewTransaction(() ->
                            warrantyService.autoIssueForSalesOrderSerial(item.getProduct(), serialId, order.getId(), customerId));
                } catch (Exception e) {
                    log.warn("Failed to auto-issue warranty for serial {} on sales order {}: {}",
                            serialId, order.getOrderNumber(), e.getMessage());
                }
            }
        }
    }

    @Transactional
    public void deleteSalesOrder(UUID id) {
        SalesOrder order = salesOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales order not found with id: " + id));

        if (order.getStatus() != SalesOrder.OrderStatus.DRAFT) {
            throw new IllegalStateException("Only draft orders can be deleted");
        }

        order.setDeletedAt(LocalDateTime.now());
        salesOrderRepository.save(order);
    }

    @Transactional
    public SalesOrderDto updateOrderStatus(UUID id, String status) {
        SalesOrder order = salesOrderRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales order not found with id: " + id));

        SalesOrder.OrderStatus newStatus = SalesOrder.OrderStatus.valueOf(status);
        validateStatusTransition(order.getStatus(), newStatus);

        // WP3: fulfilment point for tracked batch/serial lines - only on the transition INTO
        // DELIVERED, so re-sending the same status (or later transitions like -> INVOICED) never
        // decrements twice. Runs before the status is persisted so a failure (e.g. insufficient
        // batch quantity) rolls back the whole status change.
        boolean enteringDelivered = newStatus == SalesOrder.OrderStatus.DELIVERED
                && order.getStatus() != SalesOrder.OrderStatus.DELIVERED;
        if (enteringDelivered) {
            fulfillTrackedItems(order);
        }

        order.setStatus(newStatus);
        SalesOrder updatedOrder = salesOrderRepository.save(order);

        // Send WebSocket notification (Phase 6.7)
        webSocketService.notifyOrderStatusChange(SalesOrderDto.fromEntity(updatedOrder));

        // Send order confirmation email once the order is confirmed (WP2)
        if (newStatus == SalesOrder.OrderStatus.CONFIRMED) {
            sendOrderConfirmationEmail(updatedOrder);
        }

        return SalesOrderDto.fromEntity(updatedOrder);
    }

    private void sendOrderConfirmationEmail(SalesOrder order) {
        try {
            Customer customer = order.getCustomer();
            boolean hasEmail = customer != null && customer.getEmail() != null && !customer.getEmail().isBlank();
            String recipient = hasEmail ? customer.getEmail() : adminRecipient;
            String customerName = customer != null ? customer.getName() : "Customer";

            // CRITICAL FIX 3: REQUIRES_NEW via NonBlockingHookExecutor - a mail-send failure rolls
            // back only this transaction, never the order status change.
            nonBlockingHookExecutor.runInNewTransaction(() -> emailTemplateService.sendOrderConfirmation(
                    recipient,
                    customerName,
                    order.getOrderNumber(),
                    order.getTotal().doubleValue(),
                    order.getOrderDate()
            ));
        } catch (Exception e) {
            log.warn("Failed to send order confirmation email for order {}: {}", order.getOrderNumber(), e.getMessage());
        }
    }

    private void validateStatusTransition(SalesOrder.OrderStatus current, SalesOrder.OrderStatus next) {
        // Simple validation - can be enhanced
        if (current == SalesOrder.OrderStatus.CANCELLED) {
            throw new IllegalStateException("Cannot change status of cancelled order");
        }
    }

    // Second-precision timestamp alone isn't unique - see InventoryService#generateAdjustmentNumber
    // for the same collision and the same fix (random hex suffix, unique by construction).
    private String generateOrderNumber() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return "SO-" + timestamp + "-" + suffix;
    }
}
