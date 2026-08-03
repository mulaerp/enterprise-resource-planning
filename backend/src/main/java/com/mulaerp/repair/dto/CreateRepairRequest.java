package com.mulaerp.repair.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateRepairRequest {

    /** Registered customer - mutually exclusive with walkInName/walkInPhone below. */
    private UUID customerId;

    private String walkInName;

    private String walkInPhone;

    private UUID productId;

    private String serialNumber;

    @NotBlank(message = "deviceDescription is required")
    private String deviceDescription;

    @NotBlank(message = "reportedFault is required")
    private String reportedFault;

    private String notes;
}
