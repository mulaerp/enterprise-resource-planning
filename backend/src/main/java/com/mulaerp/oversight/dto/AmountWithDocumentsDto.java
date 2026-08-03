package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.util.List;

/** A single monetary aggregate with the document numbers it was built from, for UI drill-down. */
public record AmountWithDocumentsDto(
        BigDecimal amount,
        List<String> documents
) {
}
