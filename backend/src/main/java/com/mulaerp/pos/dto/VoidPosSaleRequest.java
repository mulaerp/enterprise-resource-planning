package com.mulaerp.pos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** {@code POST /pos/sales/{id}/void} request body - reason is mandatory (surfaced verbatim on
 * the sale and in the oversight exceptions "Voided sales" section, so a manager must record why). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoidPosSaleRequest {

    @NotBlank(message = "reason is required")
    private String reason;
}
