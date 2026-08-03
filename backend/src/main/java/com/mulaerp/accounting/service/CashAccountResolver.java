package com.mulaerp.accounting.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * WP (cash-leg split, V35): single source of truth mapping an operational payment-method token -
 * {@code PosSale.paymentMethod}/{@code PosTradeIn.payoutType} ({@code CASH|CARD|EWALLET|
 * STORE_CREDIT}), {@code RepairPayment.paymentMethod} (same four values), and
 * {@code Payment.method} ({@code CASH|CREDIT_CARD|DEBIT_CARD|BANK_TRANSFER|CHECK|OTHER}) - to the
 * chart-of-accounts code that should receive the cash/clearing leg of a posting.
 *
 * <p>Before this class existed, every posting site hardcoded account {@code 1110} "Cash and Cash
 * Equivalents" regardless of how the customer actually paid, so the balance sheet could never
 * distinguish physical till cash from card/e-wallet money that hasn't settled to the bank yet, and
 * bank reconciliation had nothing of its own to clear against. See
 * {@code V35__split_cash_clearing_accounts.sql} for the accounts themselves (1110 is kept exactly
 * as posted history left it, but is marked inactive so nothing new can be posted to it) and every
 * posting site that used to reference "1110" directly (PosSaleService, PosTradeInService,
 * PaymentService, RepairJobService, BankReconciliationService) for how this resolver is used
 * instead.
 *
 * <h2>Mapping (the single source of truth - update this javadoc if the mapping ever changes)</h2>
 * <ul>
 *   <li>{@code CASH} -&gt; {@value #CASH_ON_HAND} Cash on Hand - physical till cash.</li>
 *   <li>{@code CARD}, {@code CREDIT_CARD}, {@code DEBIT_CARD} -&gt; {@value #CARD_CLEARING} Card
 *   Clearing - card takings not yet settled to the bank.</li>
 *   <li>{@code EWALLET} -&gt; {@value #EWALLET_CLEARING} E-Wallet Clearing - same idea as Card
 *   Clearing, for e-wallet takings.</li>
 *   <li>{@code BANK_TRANSFER}, {@code CHECK} -&gt; {@value #BANK_ACCOUNT} Bank Account - these
 *   land straight in the bank, so there is nothing to clear later.</li>
 *   <li>{@code STORE_CREDIT} -&gt; {@value #STORE_CREDIT_LIABILITY} Store Credit Liability -
 *   deliberately NOT a cash/clearing account: redeeming or paying with store credit moves a
 *   liability, it never touches till cash or a bank-clearing account.</li>
 *   <li>{@code OTHER}, {@code null}, blank, or anything unrecognised -&gt; falls back to
 *   {@value #CASH_ON_HAND} Cash on Hand, with a WARN log documenting the fallback - a conservative
 *   default (every branch can still manually reconcile physical cash) rather than silently
 *   dropping the posting or throwing mid-transaction.</li>
 * </ul>
 *
 * <p>Matching is case-insensitive; callers backed by a Java enum (e.g. {@code Payment.method})
 * pass {@code paymentMethod.name()}.
 */
@Slf4j
@Component
public class CashAccountResolver {

    public static final String CASH_ON_HAND = "1111";
    public static final String CARD_CLEARING = "1112";
    public static final String EWALLET_CLEARING = "1113";
    public static final String BANK_ACCOUNT = "1114";
    public static final String STORE_CREDIT_LIABILITY = "2140";

    /**
     * Resolves a payment-method token to the account code that should receive its cash/clearing
     * leg. Never returns null - unknown/blank/null input falls back to {@link #CASH_ON_HAND} with
     * a WARN log (see class javadoc for the full mapping and rationale).
     */
    public String resolveCode(String paymentMethod) {
        String normalized = paymentMethod == null ? "" : paymentMethod.trim().toUpperCase();
        return switch (normalized) {
            case "CASH" -> CASH_ON_HAND;
            case "CARD", "CREDIT_CARD", "DEBIT_CARD" -> CARD_CLEARING;
            case "EWALLET" -> EWALLET_CLEARING;
            case "BANK_TRANSFER", "CHECK" -> BANK_ACCOUNT;
            case "STORE_CREDIT" -> STORE_CREDIT_LIABILITY;
            default -> {
                log.warn("Unrecognized payment method '{}' - falling back to Cash on Hand ({}) for its "
                        + "cash/clearing leg", paymentMethod, CASH_ON_HAND);
                yield CASH_ON_HAND;
            }
        };
    }
}
