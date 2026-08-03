package com.mulaerp.oversight.dto;

import java.math.BigDecimal;

/**
 * Discount breakdown for {@link MyDayResponseDto#getDiscountsGiven()}.
 *
 * <p><b>Approximation caveat:</b> {@code PosSale} only persists the aggregate
 * {@code discountTotal} (member % off + voucher + cart discount, summed) - there is no
 * column-level split of the three by type. {@code memberDiscount}/{@code voucherDiscount} here are
 * recomputed from the sale's own {@code subtotal} against the member's/voucher's CURRENT
 * definition (discount percent / voucher type+value), replaying the same sequential formula
 * {@code PosSaleService#createSale} used (member % of subtotal, then voucher off what's left);
 * {@code cartDiscount} is then whatever remains of {@code discountTotal} after those two, clamped
 * to zero. This is exact for a same-day report unless the member's tier or the voucher's
 * definition changed since the sale was rung up earlier today - a real but narrow gap, called out
 * here rather than silently presented as exact, and one this module cannot close without adding a
 * per-type column to {@code pos_sales} (a `pos` module schema change, out of this work package's
 * scope).
 */
public record MyDayDiscountsDto(
        BigDecimal memberDiscount,
        BigDecimal voucherDiscount,
        BigDecimal cartDiscount,
        BigDecimal total
) {
}
