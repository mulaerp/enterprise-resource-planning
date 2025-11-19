package com.mulaerp.sales.controller;

import com.mulaerp.sales.dto.CreateSalesOrderRequest;
import com.mulaerp.sales.dto.SalesOrderDto;
import com.mulaerp.sales.dto.UpdateSalesOrderRequest;
import com.mulaerp.sales.service.SalesOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/sales-orders")
@RequiredArgsConstructor
public class SalesOrderController {

    private final SalesOrderService salesOrderService;

    @GetMapping
    public ResponseEntity<Page<SalesOrderDto>> getAllSalesOrders(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "orderDate") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase("ASC") 
                ? Sort.by(sortBy).ascending() 
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<SalesOrderDto> orders = salesOrderService.getAllSalesOrders(search, pageable);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SalesOrderDto> getSalesOrderById(@PathVariable String id) {
        SalesOrderDto order = salesOrderService.getSalesOrderById(id);
        return ResponseEntity.ok(order);
    }

    @PostMapping
    public ResponseEntity<SalesOrderDto> createSalesOrder(@Valid @RequestBody CreateSalesOrderRequest request) {
        SalesOrderDto order = salesOrderService.createSalesOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(order);
    }

    @PutMapping("/{id}")
    public ResponseEntity<SalesOrderDto> updateSalesOrder(
            @PathVariable String id,
            @Valid @RequestBody UpdateSalesOrderRequest request) {
        SalesOrderDto order = salesOrderService.updateSalesOrder(id, request);
        return ResponseEntity.ok(order);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSalesOrder(@PathVariable String id) {
        salesOrderService.deleteSalesOrder(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<SalesOrderDto> updateOrderStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {
        String status = request.get("status");
        SalesOrderDto order = salesOrderService.updateOrderStatus(id, status);
        return ResponseEntity.ok(order);
    }
}
