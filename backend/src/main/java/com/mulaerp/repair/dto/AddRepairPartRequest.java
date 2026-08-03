package com.mulaerp.repair.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** POST /repairs/{id}/parts. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AddRepairPartRequest {

    @NotNull(message = "productId is required")
    private UUID productId;

    @NotNull(message = "quantity is required")
    @Min(value = 1, message = "quantity must be at least 1")
    private Integer quantity;
}
