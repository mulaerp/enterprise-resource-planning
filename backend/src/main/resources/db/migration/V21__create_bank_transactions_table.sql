-- ACC-BANK: bank statement import + reconciliation.
-- One row per imported statement line; rows from the same upload share import_batch_id.
-- amount convention: positive = credit (money in), negative = debit (money out).

CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    txn_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    reference VARCHAR(100),
    source_filename VARCHAR(255),
    reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    matched_payment_id UUID REFERENCES payments(id),
    import_batch_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_bank_transactions_txn_date ON bank_transactions(txn_date);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(reconciled);
CREATE INDEX idx_bank_transactions_import_batch_id ON bank_transactions(import_batch_id);
CREATE INDEX idx_bank_transactions_matched_payment_id ON bank_transactions(matched_payment_id);
CREATE INDEX idx_bank_transactions_deleted ON bank_transactions(deleted);
-- Dedupe check on (txn_date, amount, description) runs on every import row.
CREATE INDEX idx_bank_transactions_dedupe ON bank_transactions(txn_date, amount, description);
