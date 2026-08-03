-- WP: repair payment refunds (partial or full) - extends repair_payments to represent money going
-- BACK to the customer, not just money coming in. Until now a repair job could accumulate
-- DEPOSIT/BALANCE/FULL payments but had no way to give any of it back (job cancelled after a
-- deposit, overpayment at collection, re-quote lower than the deposit taken, goodwill refund).
--
-- MODEL CHOICE: explicit columns (is_refund + original_payment_id + refund_reason + refunded_by),
-- NOT a REFUND amount_type with a signed-amount convention. Rationale (see RepairPayment class
-- javadoc for the full write-up):
--   - `amount` stays a simple positive quantity on every row, always. There is no risk of a stray
--     unsigned SUM(amount) silently over- or under-counting because a caller forgot a sign, and no
--     risk of a refund being entered with the wrong sign.
--   - amount_type (DEPOSIT/BALANCE/FULL) is preserved unmodified and copied onto the refund row
--     purely as informational metadata about *what kind of payment* is being refunded. It is never
--     used to derive accounting treatment - see RepairJobService#refundPayment javadoc: the journal
--     case (clear the deposit liability vs. reverse recognized revenue) is derived strictly from
--     the job's status, never guessed from amount_type.
--   - original_payment_id links a refund row back to the exact payment it refunds, giving a clean
--     one-hop audit trail without ever mutating the original row - repair_payments stays
--     append-only exactly as it always has been (same rationale as StockMovement/RepairPart).
--   - Net paid for a job is then trivially: SUM(amount) WHERE is_refund = false MINUS SUM(amount)
--     WHERE is_refund = true (collections minus refunds) - see RepairJobService#computeNetPaid.
ALTER TABLE repair_payments
    ADD COLUMN is_refund BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN original_payment_id UUID NULL REFERENCES repair_payments(id),
    ADD COLUMN refund_reason TEXT NULL,
    ADD COLUMN refunded_by VARCHAR(255) NULL;

-- A refund row must always carry the reason, the acting user, and a link to what it refunds; a
-- normal (non-refund) payment row must never carry any refund-only metadata.
ALTER TABLE repair_payments
    ADD CONSTRAINT chk_repair_payment_refund_fields CHECK (
        (is_refund = FALSE AND original_payment_id IS NULL AND refund_reason IS NULL AND refunded_by IS NULL)
        OR
        (is_refund = TRUE AND original_payment_id IS NOT NULL AND refund_reason IS NOT NULL AND refunded_by IS NOT NULL)
    );

CREATE INDEX idx_repair_payments_original_payment_id ON repair_payments(original_payment_id)
    WHERE original_payment_id IS NOT NULL;

-- Note on the refund-to-store-credit path: RepairJob only carries customerId
-- (com.mulaerp.customer.entity.Customer), never a memberId - Customer and Member are separate
-- entities with no direct FK between them anywhere else in the schema either (PosSale/PosTradeIn
-- carry their own independent memberId). RepairJobService#resolveMemberForStoreCreditRefund
-- resolves "is this job's customer a member" by matching Customer.phone against Member.phone,
-- which already has a UNIQUE constraint (and therefore an index) from V18 - no new index needed
-- here for that lookup.
