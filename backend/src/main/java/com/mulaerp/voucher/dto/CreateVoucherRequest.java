package com.mulaerp.voucher.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateVoucherRequest {

    @NotBlank(message = "Code is required")
    private String code;

    @NotBlank(message = "Type is required")
    private String type;

    @NotNull(message = "Value is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Value must be positive")
    private BigDecimal value;

    @DecimalMin(value = "0.0", inclusive = true, message = "Minimum spend must be positive")
    private BigDecimal minSpend;

    private LocalDate expiresAt;

    @Min(value = 1, message = "Usage limit must be at least 1")
    private Integer usageLimit;

    private Boolean active;
}
