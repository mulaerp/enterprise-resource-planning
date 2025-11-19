package com.mulaerp.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateSerialRequest {

    @NotNull(message = "Product ID is required")
    private UUID productId;

    @NotBlank(message = "Serial number is required")
    private String serialNumber;

    private LocalDate purchaseDate;

    private LocalDate warrantyExpiryDate;

    private UUID warehouseId;

    private String notes;
}
