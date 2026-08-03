package com.mulaerp.oversight.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Compares the period's operational revenue figure against what has actually been POSTED to the
 * Sales Revenue (4100) / Service Revenue (4200) accounts for the same period.
 *
 * <p><b>Cross-check option chosen: (a) - operational tally now includes invoice revenue.</b>
 * {@code operationalRevenue} here is PoS goods revenue + repair service revenue (the same figures
 * as {@link MoneyFlowResponseDto#totalRevenue}) <em>plus</em> every invoice's total for the period
 * (see {@code MoneyFlowService#buildCrossCheck}), because {@code InvoiceService
 * #createInvoiceJournalEntry} books Sales Revenue for every invoice at creation time regardless of
 * its own DRAFT/SENT/PAID/OVERDUE/CANCELLED status - so {@code postedJournalRevenue} (summed
 * straight from POSTED journal activity on 4100/4200) already includes invoice-sourced credits.
 * Before this fix, the operational side never counted invoice revenue at all, so on any
 * environment with real invoice activity this cross-check permanently reported a mismatch for a
 * reason that had nothing to do with unposted drafts - a false positive, not a useful signal.
 * {@link MoneyFlowResponseDto#totalRevenue} itself is deliberately left unchanged (PoS + repair
 * only) since it drives COGS/gross-margin, which has no invoice-side equivalent to net against.
 *
 * <p>With that fix, {@code matchesOperational == false} now means what it always should have: one
 * or more DRAFT journal entries affecting revenue accounts exist for the period and have not been
 * posted yet ({@code unpostedDraftRevenueEntryNumbers}/{@code unpostedDraftRevenueCount}), or a
 * manual journal entry doesn't match what actually happened operationally. It is a visibility
 * signal, not necessarily an error, but it must never be hidden - and it must be silent
 * ({@code matchesOperational == true}) whenever the books genuinely agree.
 */
public record PostedJournalCrossCheckDto(
        BigDecimal operationalRevenue,
        BigDecimal postedJournalRevenue,
        boolean matchesOperational,
        String note,
        int unpostedDraftRevenueCount,
        List<String> unpostedDraftRevenueEntryNumbers
) {
}
