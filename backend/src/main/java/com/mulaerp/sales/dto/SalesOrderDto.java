package com.mulaerp.sales.dto;

import com.mulaerp.sales.entity.SalesOrder;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SalesOrderDto {
    private String id;
    private String orderNumber;
    private String customerId;
    private String customerName;
    private LocalDate orderDate;
    private LocalDate deliveryDate;
    private String status;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal total;
    private String notes;
    private List<SalesOrderItemDto> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static SalesOrderDto fromEntity(SalesOrder order) {
        SalesOrderDto dto = new SalesOrderDto();
        dto.setId(order.getId().toString());
        dto.setOrderNumber(order.getOrderNumber());
        dto.setCustomerId(order.getCustomer().getId().toString());
        dto.setCustomerName(order.getCustomer().getName());
        dto.setOrderDate(order.getOrderDate());
        dto.setDeliveryDate(order.getDeliveryDate());
        dto.setStatus(order.getStatus().name());
        dto.setSubtotal(order.getSubtotal());
        dto.setTax(order.getTax());
        dto.setTotal(order.getTotal());
        dto.setNotes(order.getNotes());
        dto.setCreatedAt(order.getCreatedAt());
        dto.setUpdatedAt(order.getUpdatedAt());
        
        if (order.getItems() != null) {
            dto.setItems(order.getItems().stream()
                    .map(SalesOrderItemDto::fromEntity)
                    .collect(Collectors.toList()));
        }
        
        return dto;
    }
}
