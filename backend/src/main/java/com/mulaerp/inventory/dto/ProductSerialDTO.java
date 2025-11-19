package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.ProductSerial;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductSerialDTO {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private String serialNumber;
    private LocalDate purchaseDate;
    private LocalDate warrantyExpiryDate;
    private ProductSerial.SerialStatus status;
    private UUID customerId;
    private String customerName;
    private UUID salesOrderId;
    private String salesOrderNumber;
    private UUID warehouseId;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
