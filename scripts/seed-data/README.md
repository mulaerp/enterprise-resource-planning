# Gamer's Hideout trade-in catalogue — seed data

## Source

- Sheet: [Gamer's Hideout Trade in Value](https://docs.google.com/spreadsheets/d/1fd3JbRn7TSIYj7OFTrBsIPnqgL8xu_uf92Jtxd_ZngY/edit?gid=215723113#gid=215723113) (public, view-shared Google Sheet)
- Fetch date: 2026-07-31
- This is a **trade-in / buy-side** price list published by a Malaysian used-games shop, not a
  resale catalogue — see the "Sell price assumption" note below.

## Fetch method

The direct `export?format=csv` and `export?format=xlsx` endpoints returned an HTML Google
sign-in gate (the sheet requires an authenticated session for those export routes even though
it is publicly view-shared). Playwright was not needed — the **gviz endpoint** worked without
authentication for every tab:

```
https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&gid=<gid>
```

Tabs (and their gids) were enumerated from the unauthenticated
`https://docs.google.com/spreadsheets/d/<id>/htmlview` page, which embeds a JS array of
`{name, gid}` for every sheet tab even when the interactive editor itself is sign-in gated.

## Tabs found

| Tab | gid | Raw file | Contains |
|---|---|---|---|
| PS4 Games | 215723113 | `raw-gamershideout-215723113.csv` | product/price data |
| PS5 Games | 0 | `raw-gamershideout-0.csv` | product/price data |
| Nintendo Switch Games | 1315676853 | `raw-gamershideout-1315676853.csv` | product/price data |
| Nintendo Switch 2 Games | 2051134862 | `raw-gamershideout-2051134862.csv` | product/price data |
| Consoles | 1827613399 | `raw-gamershideout-1827613399.csv` | product/price data (2 side-by-side tables: consoles + controller accessories) |
| Hand Held | 1253123954 | `raw-gamershideout-1253123954.csv` | product/price data |
| Terms & Conditions | 20050759 | *(not saved)* | legal text only, no products — dropped |

## Column mapping

The four "Games" tabs share one layout: `Product Name`, `Cash Value` (e.g. `RM10`), `Store
credit` (plain number, no `RM` prefix), then several blank/noise columns (inline notes such as
WhatsApp contact info or region-deduction caveats, and an unrelated stray numeric column with no
header that doesn't correlate with price — ignored).

The `Consoles` tab has **two side-by-side tables** sharing rows: columns A–C are consoles
(`Consoles type`, cash, credit), columns G–I are pre-owned controllers (`... CONTROLLER`, cash,
credit). `Hand Held` is a single clean table (`HandHeld type`, `Trade-In Price Cash`, `Store
Credit`).

| Sheet column | Normalised column | Rule |
|---|---|---|
| Product/console/controller name | `name` | trimmed as-is |
| — (derived) | `sku` | `GH-<CATEGORYCODE>-<slug>-<NNN>`, e.g. `GH-PS4-alan-wake-004` |
| Tab / block | `category` | `PS4 Games`, `PS5 Games`, `Nintendo Switch Games`, `Nintendo Switch 2 Games`, `Consoles`, `Accessories` (controllers), `Handhelds` |
| Cash Value / Trade-In Price Cash | `costPrice`, `acquisitionCost`, `buyPrice` | RM stripped, comma-thousands stripped, parsed as decimal |
| Store credit / Store Credit | `unitPrice` | see assumption below |
| — (fixed) | `stockQuantity` | `0` — stock comes from intake later |
| — (fixed) | `condition` | `GOOD` (default) |
| Tab | `tags` | single lower-case platform tag: `ps4`, `ps5`, `switch`, `switch2`, `console`, `accessory`, `handheld` |

### Sell-price assumption (flag for review)

The sheet is a **trade-in payout list**, not a resale price list — it has no column for what
Gamer's Hideout actually sells items for to end customers. It only has two payout options for
the same transaction: `Cash Value` (lower, real cash cost) and `Store credit` (higher, paid as
store credit instead of cash). Neither is a "sell price" in the ERP sense.

To satisfy the ERP's mandatory `unitPrice` field without fabricating a number, this import maps:
- `costPrice` / `acquisitionCost` / `buyPrice` = **Cash Value** (the real cash outlay — a
  defensible cost basis)
- `unitPrice` = **Store credit** value (the only other figure in the data, and it is always ≥
  Cash Value in every row, so no row has a negative margin)

This keeps every row import-valid and non-loss-making, but `unitPrice` here is **not a designed
resale price** — confirm the actual resale/markup policy with the business before relying on
these `unitPrice` values for real sales.

## Parser compatibility

Read `backend/src/main/java/com/mulaerp/product/service/ProductCsvParser.java`: the header
mapper (`mapHeader`) has a `default -> { /* unrecognized column - ignored */ }` branch, so unknown
columns are silently skipped rather than rejected. `catalog-import.csv` includes the extra
`buyPrice` column (for the trade-in-price feature being built) safely — today's importer ignores
it, keying only on `sku, name, category, costPrice, unitPrice, stockQuantity, condition, tags,
acquisitionCost`. A row is only rejected if `sku`, `name`, `costPrice`, `unitPrice`, or
`stockQuantity` fail to parse; `category`, `condition`, `tags`, `acquisitionCost` are optional.

## Row counts

Cap applied: **500 rows total** (task instruction — sheet is far larger than needed for seed
data). Consoles, Accessories, and Handhelds are small and kept in full. Nintendo Switch 2 Games
is small and novel (newest platform) and kept in full. The three large "Games" tabs (PS4, PS5,
Nintendo Switch) are capped and the top rows **by Cash Value descending** are kept per tab — used
as a proxy for "popular/desirable title" since the sheet has no sales-rank or popularity column.
This is a heuristic, not verified demand data.

| Source | Raw data rows | Dropped (no usable price — RM0 or blank) | Valid after cleaning | Kept (cap) | Dropped for cap |
|---|---|---|---|---|---|
| PS4 Games | 1,713 | 100 (31 RM0 + 69 blank/unparsable) | 1,613 | 182 | 1,431 |
| PS5 Games | 594 | 62 (blank/unparsable, 0 RM0) | 532 | 60 | 472 |
| Nintendo Switch Games | 1,400 | 43 (blank/unparsable, 0 RM0) | 1,357 | 153 | 1,204 |
| Nintendo Switch 2 Games | 75 | 2 (blank/unparsable) | 73 | 73 | 0 |
| Handhelds | 7 | 0 | 7 | 7 | 0 |
| **Games/Handhelds total** | **3,789** | **207** | **3,582** | **475** | **3,107** |

"Dropped (no usable price)" rows were titles the shop explicitly doesn't buy — either an `RM0`
cash value or a fully blank price (one row literally says "FINAL FANTASY XIV: A REALM REBORN (We
Dont Take)"). These are correctly excluded from a *price* catalogue.

**Consoles tab is a special case**: it packs two side-by-side tables into the same 22 physical
data rows — columns A–C (console name/cash/credit) and columns G–I (controller
name/cash/credit). 19 of the 22 rows have a valid console entry and 6 of those *same* rows also
have a valid controller entry in the other columns; the remaining 3 rows are footnote text only
(no product) and were dropped. Net: **19 Consoles + 6 Accessories = 25 valid entries**, all kept
(no cap needed).

**Grand total: 3,582 (games/handhelds) + 25 (consoles/accessories) = 3,607 valid entries → 500
kept in `catalog-import.csv` → 3,107 dropped for the cap** (all from the three large Games tabs;
nothing was dropped from Consoles, Accessories, Handhelds, or Nintendo Switch 2 Games).

## Currency

All prices are in **Malaysian ringgit (MYR / RM)** — the games tabs show the `RM` prefix
explicitly on Cash Value; Consoles and Hand Held omit the prefix but are the same currency and
scale as the rest of the sheet. **No currency conversion was applied.**

## How to import

Via the UI: Products page → "Import CSV" button → select `scripts/seed-data/catalog-import.csv`.

Via curl (requires a MANAGER+ session/token):

```bash
curl -X POST http://localhost:8080/api/v1/products/import \
  -H "Authorization: Bearer <token>" \
  -F "file=@scripts/seed-data/catalog-import.csv"
```

Existing SKUs are skipped as duplicates (no update-in-place) — re-running the import is safe.
