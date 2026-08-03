package com.mulaerp.oversight.repository;

import com.mulaerp.invoice.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * OVERSIGHT: read-only secondary repository over {@link Invoice} - see OversightPosSaleRepository
 * javadoc for the pattern (a second Spring Data repository bound to another module's entity, so
 * oversight can query by date range without editing that module's own repository).
 *
 * <p>Backs {@link com.mulaerp.oversight.service.MoneyFlowService}'s posted-journal cross-check: the
 * operational side needs each period's invoice-sourced revenue (every invoice's total, regardless
 * of its own business status - {@code InvoiceService#createInvoiceJournalEntry} books Sales
 * Revenue for every invoice at creation time, DRAFT/SENT/PAID/OVERDUE/CANCELLED alike) so it's
 * comparable against posted-journal activity on the same account, which already includes it.
 */
@Repository
public interface OversightInvoiceRepository extends JpaRepository<Invoice, UUID> {

    List<Invoice> findByInvoiceDateBetweenAndDeletedFalse(LocalDate from, LocalDate to);
}
