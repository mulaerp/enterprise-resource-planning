package com.mulaerp.warehouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateWarehouseRequest {

    @NotBlank(message = "Warehouse code is required")
    @Size(max = 50, message = "Warehouse code must not exceed 50 characters")
    private String code;

    @NotBlank(message = "Warehouse name is required")
    @Size(max = 255, message = "Warehouse name must not exceed 255 characters")
    private String name;

    private String location;

    private Boolean active;
}
