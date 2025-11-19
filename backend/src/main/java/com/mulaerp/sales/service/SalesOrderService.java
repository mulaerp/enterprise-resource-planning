package com.mulaerp.sales.service;

import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.sales.dto.CreateSalesOrderRequest;
import com.mulaerp.sales.dto.SalesOrderDto;
import com.mulaerp.sales.dto.UpdateSalesOrderRequest;
import com.mulaerp.sales.entity.SalesOrder;
import com.mulaerp.sales.entity.SalesOrderItem;
import com.mulaerp.sales.repository.SalesOrderRepository;
import com.mulaerp.websocket.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class SalesOrderService {

    private final SalesOrderRepository salesOrderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final WebSocketService webSocketService;

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
    public SalesOrderDto getSalesOrderById(String id) {
        SalesOrder order = salesOrderRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Sales order not found with id: " + id));
        return SalesOrderDto.fromEntity(order);
    }

    @Transactional
    public SalesOrderDto createSalesOrder(CreateSalesOrderRequest request) {
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new RuntimeException("Customer not found with id: " + request.getCustomerId()));

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
                    .orElseThrow(() -> new RuntimeException("Product not found with id: " + itemRequest.getProductId()));

            SalesOrderItem item = new SalesOrderItem();
            item.setProduct(product);
            item.setQuantity(itemRequest.getQuantity());
            item.setUnitPrice(itemRequest.getUnitPrice());
            item.setDiscount(itemRequest.getDiscount() != null ? itemRequest.getDiscount() : BigDecimal.ZERO);
            item.setTaxRate(itemRequest.getTaxRate() != null ? itemRequest.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();

            order.addItem(item);
        }

        order.calculateTotals();
        SalesOrder savedOrder = salesOrderRepository.save(order);
        
        // Send WebSocket notification (Phase 6.7)
        webSocketService.notifyNewOrder(SalesOrderDto.fromEntity(savedOrder));
        
        return SalesOrderDto.fromEntity(savedOrder);
    }

    @Transactional
    public SalesOrderDto updateSalesOrder(String id, UpdateSalesOrderRequest request) {
        SalesOrder order = salesOrderRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Sales order not found with id: " + id));

        if (order.getStatus() != SalesOrder.OrderStatus.DRAFT) {
            throw new RuntimeException("Only draft orders can be updated");
        }

        order.setDeliveryDate(request.getDeliveryDate());
        order.setTax(request.getTax() != null ? request.getTax() : BigDecimal.ZERO);
        order.setNotes(request.getNotes());

        // Clear existing items
        order.getItems().clear();

        // Add new items
        for (CreateSalesOrderRequest.CreateSalesOrderItemRequest itemRequest : request.getItems()) {
            Product product = productRepository.findById(itemRequest.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found with id: " + itemRequest.getProductId()));

            SalesOrderItem item = new SalesOrderItem();
            item.setProduct(product);
            item.setQuantity(itemRequest.getQuantity());
            item.setUnitPrice(itemRequest.getUnitPrice());
            item.setDiscount(itemRequest.getDiscount() != null ? itemRequest.getDiscount() : BigDecimal.ZERO);
            item.setTaxRate(itemRequest.getTaxRate() != null ? itemRequest.getTaxRate() : BigDecimal.ZERO);
            item.calculateTotal();

            order.addItem(item);
        }

        order.calculateTotals();
        SalesOrder updatedOrder = salesOrderRepository.save(order);
        return SalesOrderDto.fromEntity(updatedOrder);
    }

    @Transactional
    public void deleteSalesOrder(String id) {
        SalesOrder order = salesOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sales order not found with id: " + id));

        if (order.getStatus() != SalesOrder.OrderStatus.DRAFT) {
            throw new RuntimeException("Only draft orders can be deleted");
        }

        order.setDeletedAt(LocalDateTime.now());
        salesOrderRepository.save(order);
    }

    @Transactional
    public SalesOrderDto updateOrderStatus(String id, String status) {
        SalesOrder order = salesOrderRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Sales order not found with id: " + id));

        SalesOrder.OrderStatus newStatus = SalesOrder.OrderStatus.valueOf(status);
        validateStatusTransition(order.getStatus(), newStatus);

        order.setStatus(newStatus);
        SalesOrder updatedOrder = salesOrderRepository.save(order);
        
        // Send WebSocket notification (Phase 6.7)
        webSocketService.notifyOrderStatusChange(SalesOrderDto.fromEntity(updatedOrder));
        
        return SalesOrderDto.fromEntity(updatedOrder);
    }

    private void validateStatusTransition(SalesOrder.OrderStatus current, SalesOrder.OrderStatus next) {
        // Simple validation - can be enhanced
        if (current == SalesOrder.OrderStatus.CANCELLED) {
            throw new RuntimeException("Cannot change status of cancelled order");
        }
    }

    private String generateOrderNumber() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "SO-" + timestamp;
    }
}
