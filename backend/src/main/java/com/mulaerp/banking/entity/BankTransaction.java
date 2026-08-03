package com.mulaerp.banking.entity;

import com.mulaerp.common.entity.BaseEntity;
import com.mulaerp.payment.entity.Payment;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * ACC-BANK: a single line item imported from an uploaded bank statement CSV.
 * Amount convention: positive = credit (money in), negative = debit (money out) - matches the
 * sign convention of most generic bank statement exports.
 */
@Entity
@Table(name = "bank_transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class BankTransaction extends BaseEntity {

    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(precision = 15, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(length = 100)
    private String reference;

    @Column(name = "source_filename")
    private String sourceFilename;

    @Column(nullable = false)
    private Boolean reconciled = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matched_payment_id")
    private Payment matchedPayment;

    @Column(name = "import_batch_id", nullable = false)
    private UUID importBatchId;
}
