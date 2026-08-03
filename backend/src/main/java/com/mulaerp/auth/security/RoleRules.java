package com.mulaerp.auth.security;

/**
 * Central {@code @PreAuthorize} expression matrix for the five-role model (WP: role expansion off
 * ADMIN/MANAGER/USER onto ADMIN/MANAGER/ACCOUNTANT/INVENTORY/CASHIER).
 *
 * <p>Controllers reference these constants (e.g. {@code @PreAuthorize(RoleRules.STOCK_WRITERS)})
 * instead of ad-hoc {@code hasRole}/{@code hasAnyRole} literals, so the entire authorization
 * surface stays legible and auditable from this one file rather than scattered combinations across
 * ~25 controllers. Every constant below always includes {@code ADMIN} (the IT superadmin
 * implicitly has everything) and every constant below except {@link #ADMIN_ONLY} also includes
 * {@code MANAGER} (the branch manager is the union of every staff role's write powers, plus the
 * oversight-only actions in {@link #MANAGER_UP}).
 *
 * <h2>Role matrix (source of truth)</h2>
 * <pre>
 * Capability                                          | CASHIER | ACCOUNTANT | INVENTORY | MANAGER | ADMIN
 * -----------------------------------------------------|:-------:|:----------:|:---------:|:-------:|:-----:
 * Reads (every module)                                 |    Y    |     Y      |     Y     |    Y    |   Y
 * PoS sales                                             |    Y    |            |           |    Y    |   Y
 * Trade-in / part-exchange (when built)                 |    Y    |            |           |    Y    |   Y
 * Repair job create / update / status advance           |    Y    |            |           |    Y    |   Y
 * Warranty claims                                       |    Y    |            |           |    Y    |   Y
 * Walk-in customer / member CREATE                      |    Y    |            |           |    Y    |   Y
 * Online order READ/READY/FULFIL (WEBSHOP)              |    Y    |            |           |    Y    |   Y
 * Online order CANCEL (staff-side, WEBSHOP)              |        |            |           |    Y    |   Y
 * Product CREATE (thrift intake)                        |    Y    |            |     Y     |    Y    |   Y
 * Product UPDATE / DELETE, CSV import                   |         |            |     Y     |    Y    |   Y
 * Stock adjustments, transfers, batches, serials        |         |            |     Y     |    Y    |   Y
 * Warehouses CRUD                                       |         |            |     Y     |    Y    |   Y
 * Purchase orders (create/update/receive), suppliers    |         |            |     Y     |    Y    |   Y
 * Stock-take (when built)                               |         |            |     Y     |    Y    |   Y
 * Journal entries create/update AND post, chart of accts |        |     Y      |           |    Y    |   Y
 * Financial statements + exports                        |         |     Y      |           |    Y    |   Y
 * Invoices, payments                                    |         |     Y      |           |    Y    |   Y
 * Bank import / match                                   |         |     Y      |           |    Y    |   Y
 * Cash-up (when built)                                  |         |     Y      |           |    Y    |   Y
 * Customer/member UPDATE, DELETE, CSV import             |        |            |           |    Y    |   Y
 * Sales orders (back-office) CRUD + status               |        |            |           |    Y    |   Y
 * Vouchers                                              |         |            |           |    Y    |   Y
 * Currency rate updates                                 |         |            |           |    Y    |   Y
 * Warranty void                                         |         |            |           |    Y    |   Y
 * Audit log READ                                        |         |            |           |    Y    |   Y
 * Oversight views (when built)                          |         |            |           |    Y    |   Y
 * Users + role assignment                                |        |            |           |         |   Y
 * Company / system settings, branding, full audit        |         |            |           |         |   Y
 * </pre>
 *
 * <p>Deletes, financial reports, vouchers, currency rates, and user/company admin are deliberately
 * withheld from CASHIER. ACCOUNTANT and INVENTORY are read-only outside their own domain (they get
 * "reads elsewhere" via the open {@code any authenticated} baseline on GET endpoints, not via a
 * constant here). MANAGER is CASHIER + ACCOUNTANT + INVENTORY's write powers plus the
 * oversight-only actions. ADMIN is the IT superadmin: users, company/system settings, branding and
 * currency *configuration*, full audit, and implicitly everything else.
 */
public final class RoleRules {

    private RoleRules() {
    }

    /** Users + role assignment; company/system settings, branding config. IT superadmin only. */
    public static final String ADMIN_ONLY = "hasRole('ADMIN')";

    /** Vouchers; currency rate updates; warranty void; audit-log read; customer/member UPDATE+DELETE+import; sales-order (back-office) CRUD. Branch-manager-and-up oversight actions with no dedicated staff role of their own. */
    public static final String MANAGER_UP = "hasAnyRole('ADMIN','MANAGER')";

    /** Journal entries create/update/POST, chart of accounts, financial statements + exports, invoices, payments, bank import/match. */
    public static final String ACCOUNTANT_WRITERS = "hasAnyRole('ADMIN','MANAGER','ACCOUNTANT')";

    /** Stock adjustments/transfers/batches/serials, warehouses, purchase orders + receiving, suppliers, product UPDATE/DELETE/CSV import. */
    public static final String STOCK_WRITERS = "hasAnyRole('ADMIN','MANAGER','INVENTORY')";

    /** Product CREATE only (thrift intake) - the one product-master action CASHIER may perform; INVENTORY/MANAGER/ADMIN can also create. */
    public static final String PRODUCT_CREATE = "hasAnyRole('ADMIN','MANAGER','INVENTORY','CASHIER')";

    /** Walk-in customer / member CREATE only - not update/delete/import. */
    public static final String CUSTOMER_MEMBER_CREATE = "hasAnyRole('ADMIN','MANAGER','CASHIER')";

    /**
     * WEBSHOP task: staff-side online order views + the READY/FULFILLED transitions
     * ({@code ShopOrderAdminController}). Deliberately CASHIER-inclusive, same shape as {@link
     * #CUSTOMER_MEMBER_CREATE} - a cashier handing an online order over at the till (or marking a
     * postal order shipped) must be able to close it out without waiting for a manager, exactly
     * like they can complete a PoS sale unsupervised. Cancelling an order (which reverses the
     * stock reservation) stays under {@link #MANAGER_UP} instead - the same staff/manager split
     * as PoS void (see that constant/skill), since reversing a reservation is closer to "undoing"
     * a transaction than completing one.
     */
    public static final String SHOP_ORDER_STAFF = "hasAnyRole('ADMIN','MANAGER','CASHIER')";

    /**
     * WEBSHOP task: any authenticated staff role, explicitly enumerated - for a controller under
     * {@code /api/v1/shop/admin/**} that otherwise wants the "no controller-level restriction, any
     * staff role" shape used elsewhere (e.g. {@code PosTradeInController}, {@code
     * RepairJobController}). That existing precedent is safe there only because those controllers
     * live under a path ({@code /api/v1/pos/**}, {@code /api/v1/repairs/**}) that {@code
     * ShopCustomerAuthenticationFilter} never authenticates against (its {@code shouldNotFilter}
     * only runs for {@code /api/v1/shop/**}). A controller mounted under {@code
     * /api/v1/shop/admin/**} does NOT get that protection for free: the filter authenticates any
     * valid {@code MULAERP_SHOP} cookie (granting only {@code ROLE_SHOP_CUSTOMER}) for every
     * {@code /api/v1/shop/**} path including {@code admin/**}, and {@code SecurityConfig}'s
     * matcher for that sub-path is only {@code authenticated()} - which a shop customer's own
     * authentication satisfies just as well as a staff one. A bare, no-{@code @PreAuthorize}
     * controller under {@code /api/v1/shop/admin/**} is therefore reachable by a logged-in shop
     * customer, not staff-only as intended - use this constant (or a narrower one) on any such
     * controller instead of leaving it unguarded.
     */
    public static final String ANY_STAFF_ROLE = "hasAnyRole('ADMIN','MANAGER','ACCOUNTANT','INVENTORY','CASHIER')";
}
