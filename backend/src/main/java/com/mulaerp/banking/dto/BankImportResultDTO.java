package com.mulaerp.banking.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BankImportResultDTO {
    private UUID importBatchId;
    private int imported;
    private int skipped;
    private int duplicates;
}
