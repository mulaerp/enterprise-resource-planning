package com.mulaerp.repair.dto;

import jakarta.validation.constraints.DecimalMin;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/** PUT /repairs/{id}: diagnosis/costs/notes only - status moves through PATCH /repairs/{id}/status. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRepairRequest {

    private String diagnosis;

    @DecimalMin(value = "0.0", inclusive = true, message = "quoteAmount must be positive")
    private BigDecimal quoteAmount;

    /** Manual parts cost - ignored (superseded) once the job has any repair_parts rows; see
     * RepairJobService#recomputeTotalCost. */
    @DecimalMin(value = "0.0", inclusive = true, message = "partsCost must be positive")
    private BigDecimal partsCost;

    @DecimalMin(value = "0.0", inclusive = true, message = "labourCost must be positive")
    private BigDecimal labourCost;

    private String notes;

    /** WP: staff-set expected pick-up date. */
    private LocalDate promisedDate;

    /** Optimistic locking - see ProductService#updateProduct for the same pattern. */
    private Long version;
}
