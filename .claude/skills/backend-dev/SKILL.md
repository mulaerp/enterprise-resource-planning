---
name: backend-dev
description: Conventions for changing the Mula ERP Spring Boot backend — migrations, module layout, error contract, roles, caching, audit. Use for backend, spring, migration, flyway, entity, endpoint, controller, api change.
---

# Backend Development

`backend/src/main/java/com/mulaerp/<module>` — no local Java toolchain is assumed to work here; build via `docker compose build backend` (see `run-stack` skill) after every change, don't try `mvn` on the host.

## Flyway migrations (`backend/src/main/resources/db/migration`)

Next version = current max `V<N>__*.sql` + 1. **Verify the actual max with `ls db/migration` before numbering a new one** — don't trust a stale count in this doc or elsewhere: the sequence currently runs up to **`V44`**, with gaps at **`V4`–`V9`, `V28`, `V33`** (all skipped, tolerated by Flyway the same as any other gap). **Never edit an already-applied migration** — Flyway checksums it; add a new one instead. `spring.jpa.hibernate.ddl-auto: validate` (`application.yml`) means Hibernate refuses to start if entity fields don't match actual columns — any entity change needs a matching migration, there's no auto-generation safety net.

**Out-of-order application**: `spring.flyway.out-of-order` is `${FLYWAY_OUT_OF_ORDER:false}` — safe by default, so a deploy that doesn't explicitly opt in fails loudly if a lower-numbered migration ever needs to apply after a higher one already has. `compose.yaml`'s `backend` service sets it `true` for local dev only (V42/V43 landed out of numeric order across parallel working sessions there) — don't assume that dev default holds outside Docker Compose.

## Module layout

Each module (`pos`, `member`, `voucher`, `accounting`, `banking`, `inventory`, `warehouse`, `invoice`, `product`, `customer`, `repair`, `warranty`, `oversight`, `publicapi`, `currency`, `seed`, etc.) follows `entity / repository / service / controller / dto`:
- **entity** extends `BaseEntity` (`com.mulaerp.common.entity`): UUID id, `createdAt/updatedAt/createdBy/updatedBy` (Hibernate `AuditingEntityListener`), soft delete (`deleted` boolean + `deletedAt`), and `@Version` optimistic locking (Hibernate auto-manages the column; service code additionally compares client-submitted vs. loaded version on update flows so a stale find-modify-save surfaces as 409).
- **repository** — use `JpaSpecificationExecutor` for filtered/searchable lists. Don't hand-roll `(:param IS NULL OR field = :param)` JPQL for optional filters — it breaks on Postgres parameter binding; existing modules with search (e.g. `MemberRepository.searchMembers`) show the working pattern.

## Error contract (`GlobalExceptionHandler`)

Every error response shares one shape: `{timestamp, status, error, message, path, fieldErrors?}`. Mapping to know:
- `ResourceNotFoundException` → 404
- `IllegalArgumentException` → 400
- `IllegalStateException` → 409
- `ObjectOptimisticLockingFailureException` / `jakarta.persistence.OptimisticLockException` → 409 ("This record was modified by someone else...")
- Bean validation (`MethodArgumentNotValidException`) → 400 with `fieldErrors: [{field, message}]`
- `org.springframework.web.servlet.resource.NoResourceFoundException` (an unmapped/typo'd path — Spring Boot 3.4/Framework 6.2 raises this instead of falling through silently) / `NoHandlerFoundException` (defensive companion, only reachable if `spring.mvc.throw-exception-if-no-handler-found` is ever enabled) → 404, message names the method + path that wasn't found
Throw the right one from a service method rather than a bare `RuntimeException` (which falls through to a generic 500). A genuinely unmatched route used to fall through the same way — logged as "Unhandled Exception" and reported as a confusing 500 — until the two handlers above were added; the `RuntimeException`/`Exception` catch-alls are otherwise untouched and still log a stack trace + 500 for real unexpected failures.

## Roles (`@PreAuthorize`, `ROLE_` prefix baked into the JWT)

Five roles: `ADMIN`, `MANAGER`, `ACCOUNTANT`, `INVENTORY`, `CASHIER` (old `USER` was data-migrated to `CASHIER` in `V27__expand_role_model.sql`) — plus the entirely separate webshop-only `ROLE_SHOP_CUSTOMER` (see the `webshop` skill; never mix it into a staff-role expression). `RoleRules.java` (`com.mulaerp.auth.security`) is the single source of truth for the whole `@PreAuthorize` matrix — its class javadoc has the full capability table; controllers reference its constants (`RoleRules.ADMIN_ONLY`, `.MANAGER_UP`, `.ACCOUNTANT_WRITERS`, `.STOCK_WRITERS`, `.PRODUCT_CREATE`, `.CUSTOMER_MEMBER_CREATE`, `.SHOP_ORDER_STAFF`, `.ANY_STAFF_ROLE`) rather than ad-hoc `hasRole`/`hasAnyRole` literals. Read that file before changing or adding any authz check — don't hand-roll a new role expression inline. Summary:

- **ADMIN only** (`ADMIN_ONLY`): users, company/system settings, branding.
- **MANAGER and up** (`MANAGER_UP`): audit-log read, vouchers, currency rate updates, warranty void, customer/member UPDATE+DELETE+CSV-import, sales-order (back-office) CRUD, web-order cancel/void, runtime settings (`GET`/`PUT /api/v1/settings`, `com.mulaerp.settings`).
- **ACCOUNTANT and up** (`ACCOUNTANT_WRITERS`): chart of accounts CRUD, journal entries create/update/**post** (posting is an ACCOUNTANT function now, not ADMIN-only) plus the drafts-preview/post-batch endpoints, financial statement reports incl. GETs and exports, invoices, payments, bank import/match/unmatch.
- **INVENTORY and up** (`STOCK_WRITERS`): warehouses CRUD, stock adjustments/transfers/batches/serials, purchase orders + receiving, suppliers, product UPDATE/DELETE/CSV-import.
- **CASHIER and up** (`PRODUCT_CREATE` / `CUSTOMER_MEMBER_CREATE`): product CREATE (thrift intake) and walk-in customer/member CREATE only — not update/delete/import.
- **`SHOP_ORDER_STAFF`** (ADMIN/MANAGER/CASHIER): web-order list/get/ready/fulfil — deliberately cashier-inclusive, a cashier handing over a collected order must be able to close it out unsupervised. **`ANY_STAFF_ROLE`** (all five staff roles, no INVENTORY/ACCOUNTANT exclusion): staff-only surfaces with no narrower natural owner, e.g. `ShopAdminQuoteController`.
- **No controller-level restriction** (any authenticated user): most GETs, PoS sale creation, repair job create/update/status, warranty claims.

Every constant always includes `ADMIN`; every constant except `ADMIN_ONLY` also includes `MANAGER` (MANAGER is the union of every staff role's write powers plus the oversight-only actions in `MANAGER_UP`).

## Caching (`CacheConfig`, Valkey via Redis client)

`ProductDto` (and customers/suppliers/categories) are `@Cacheable`. `GenericJackson2JsonRedisSerializer`'s default ObjectMapper does **not** register `JavaTimeModule` — any DTO with a `LocalDateTime` field then fails to serialize on cache write (500 on the GET, works fine on POST which never touches cache). `CacheConfig` supplies its own `ObjectMapper` with `JavaTimeModule` registered plus default typing re-enabled. Any code that mutates a cached entity outside its owning service (e.g. `PosSaleService` mutating `Product` directly) **must** call the owning service's `evict*Cache(id)` method, or a stale DTO gets served.

## Audit (`com.mulaerp.audit.listener.AuditPersistenceEventListener`)

Registered directly against Hibernate's `EventListenerRegistry` (not `@EntityListeners` — avoids the Spring-bean-inside-JPA-listener wiring problem, and gets `PostUpdateEvent#getOldState()`/`getState()` for a real old→new diff). Writes are deferred to a `TransactionSynchronization#afterCompletion(STATUS_COMMITTED)` — a rolled-back transaction produces no audit row; the write itself runs in `REQUIRES_NEW`. `AuditLog` itself is excluded from being audited (no infinite recursion). Applies to every `BaseEntity` subclass automatically — no per-entity opt-in needed. `GET /audit-logs` also filters by `entityId` (alongside entity type/username/action/date range) for pulling one entity's full history.

## Stock mutations

Any code path that changes stock quantity **must** record a `StockMovement` row in the same transaction (see `pos`/`inventory` skills for the full list of `MovementType`s and existing call sites) — don't change `Product.stockQuantity` or `warehouse_stock` without one. `Product.stockQuantity` is also no longer settable via the product update endpoint (accepted, ignored server-side); an adjustment that would take stock negative is rejected (400).

## Non-blocking side-effect hooks

Email (`com.mulaerp.email.service.EmailService`) and auto-journal entries (invoice/payment/PoS/repair) are both wrapped in try/catch at the call site and only logged on failure — a failing email or journal post must never fail the underlying business operation (invoice creation, payment, sale, repair status change). Follow this pattern for any new side-effect hook of the same kind. Reminder (see `accounting` skill): these post as `DRAFT` — reports don't reflect them until posted.

## Rate limiting

`RateLimitFilter` + `RateLimitConfig` only guard `/api/v1/auth/**` (300 requests / 15 min per IP, keyed on the direct socket address). It's in-memory (`ConcurrentHashMap`) — restart the backend to reset it (relevant before running the full e2e suite back-to-back).
