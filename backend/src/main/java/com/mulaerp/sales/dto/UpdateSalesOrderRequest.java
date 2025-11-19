package com.mulaerp.sales.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSalesOrderRequest {

    private LocalDate deliveryDate;
    private BigDecimal tax;
    private String notes;

    @NotEmpty(message = "Order must have at least one item")
    @Valid
    private List<CreateSalesOrderRequest.CreateSalesOrderItemRequest> items;
}
