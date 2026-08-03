package com.mulaerp.util;

/**
 * DATA INTEGRITY fix (post-overhaul audit): endpoints that build a {@code PageRequest} manually
 * from client-supplied {@code page}/{@code size} query params (as opposed to Spring's own
 * {@code Pageable} binding, which isn't capped either but is out of scope here) previously
 * honoured any {@code size} value verbatim - {@code size=999999999} loaded the entire table in
 * one response. {@link #cap(int)} clamps to a sane maximum; callers still fall back to their own
 * default when the caller passes a non-positive size.
 */
public final class PageSizeCap {

    /**
     * Applies uniformly across the controllers below. Verification-gate finding (post-fix audit
     * re-check): the original 200 cap silently truncated the "load the full catalog for a select
     * dropdown" calls used by ProductSelector/CustomerSelector/SupplierSelector and
     * SalesOrderFormPage - each requests {@code size=1000} on purpose - once the underlying table
     * passed 200 rows (a normal thrift-store product count, not an edge case). That truncation
     * silently dropped alphabetically-later rows from those dropdowns, e.g. breaking sales-order
     * creation for any newly added product outside the first 200 - reproduced live via
     * frontend/tests/e2e/sales-orders.spec.ts "should create a new sales order" against a
     * catalog of ~700 products. Raised to 1000 to match what those call sites already request:
     * still a firm, bounded cap (the audit finding was literally unbounded {@code
     * size=999999999} loading an entire ever-growing table in one response), just one large
     * enough for the UI patterns that actually exist in this codebase today.
     */
    public static final int MAX_PAGE_SIZE = 1000;

    private PageSizeCap() {
    }

    public static int cap(int requestedSize) {
        if (requestedSize <= 0) {
            return requestedSize;
        }
        return Math.min(requestedSize, MAX_PAGE_SIZE);
    }
}
