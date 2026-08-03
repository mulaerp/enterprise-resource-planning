package com.mulaerp.customer.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** WP10: result of POST /api/v1/customers/import. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerImportResultDTO {
    private int imported;
    private int skipped;
    private int duplicates;
    private List<ImportRowError> errors;

    /** {@code row} is the 1-based line number in the uploaded CSV file. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportRowError {
        private int row;
        private String message;
    }
}
