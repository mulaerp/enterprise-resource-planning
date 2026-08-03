package com.mulaerp.warranty.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClaimWarrantyRequest {

    @NotBlank(message = "reportedFault is required")
    private String reportedFault;
}
