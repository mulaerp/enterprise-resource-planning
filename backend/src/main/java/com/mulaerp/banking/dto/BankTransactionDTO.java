package com.mulaerp.banking.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class BankTransactionDTO {
    private UUID id;
    private LocalDate txnDate;
    private String description;
    private BigDecimal amount;
    private String reference;
    private String sourceFilename;
    private Boolean reconciled;
    private UUID matchedPaymentId;
    private String matchedPaymentNumber;
    private UUID importBatchId;
    private LocalDateTime createdAt;
}
