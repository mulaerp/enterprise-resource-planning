package com.mulaerp.common.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * CRITICAL FIX 3 (post-overhaul audit): runs a non-blocking side-effect (auto-journal entry,
 * notification email, warranty auto-issue, ...) in its own, independent transaction
 * (Propagation.REQUIRES_NEW) so a genuine failure inside it can never mark the CALLER's
 * transaction rollback-only.
 *
 * <p>Before this existed, every "non-blocking" hook (PosSaleService/RepairJobService/
 * InvoiceService/PaymentService/SalesOrderService's journal/email/warranty hooks) was wrapped in
 * a try/catch that logged and swallowed the exception - but the hook itself ran in the SAME
 * physical transaction as the parent business operation (Spring's default REQUIRED propagation
 * just joins whatever transaction is already open). A failure deep inside the hook (e.g.
 * AccountingService#createJournalEntry throwing on an unbalanced entry, or a mail send throwing)
 * marks that shared transaction rollback-only; the try/catch swallows the exception so nothing
 * looks wrong at the call site, but Spring still throws UnexpectedRollbackException when the
 * OUTER @Transactional method tries to commit - silently destroying the whole sale/invoice/repair
 * job while the caller's log only shows a harmless-looking warning.
 *
 * <p>Routing the actual side-effecting call through {@link #runInNewTransaction(Runnable)}
 * suspends the caller's transaction for the duration of the hook and gives the hook its own
 * commit/rollback boundary - a failure rolls back only the hook's own work (e.g. a half-written
 * journal entry) and never touches the parent. Callers must still keep their own try/catch around
 * this call (this class does not swallow anything itself) so the failure is logged.
 *
 * <p>IMPORTANT: must be called through the injected bean (i.e. from another Spring bean), never
 * self-invoked - a plain {@code this.someMethod()} call from within the same class bypasses the
 * Spring AOP proxy entirely, so {@code @Transactional} on that method would have no effect and
 * REQUIRES_NEW would silently not apply.
 */
@Service
public class NonBlockingHookExecutor {

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void runInNewTransaction(Runnable action) {
        action.run();
    }
}
