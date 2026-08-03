package com.mulaerp.oversight.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * "My Day" - a cashier's own shift report, for reconciling their own till before handover. Sourced
 * entirely from OPERATIONAL tables (PoS sales, trade-ins, repair payments - same tables/pattern as
 * {@link com.mulaerp.oversight.service.MoneyFlowService}/{@link com.mulaerp.oversight.service.CashUpService}),
 * never from journal entries.
 *
 * <p><b>DELIBERATELY EXCLUDED: COGS, margin, and any cost price.</b> Those are manager/owner
 * information (see {@code MoneyFlowResponseDto}) - a cashier reconciling their own drawer has no
 * legitimate need to see what the shop paid for what it sold, and every field below is chosen so
 * that figure is never derivable from this response either (no acquisitionCostSnapshot, no
 * costPrice, nothing COGS-shaped anywhere in this DTO tree).
 *
 * <p>{@code expectedCashInDrawer = cash sales (netCashAmount, COMPLETED sales, CASH method) -
 * cash trade-in payouts (payoutType CASH) - cash refunds (RepairPayment rows with isRefund=true,
 * paymentMethod CASH, refundedBy this cashier)} - see {@link com.mulaerp.oversight.service.MyDayService}
 * javadoc for the full derivation and why a void ({@link #getVoidedSales()}) also pulls this figure
 * down (the voided sale's cash never happened as far as the till is concerned once reversed).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MyDayResponseDto {

    private LocalDate date;

    /** The cashier this report is for - always resolved server-side, see {@code MyDayService}. */
    private String username;

    /** COMPLETED sales only - a voided sale is never counted here, see {@link #getVoidedSales()}. */
    private int saleCount;

    /** Sum of line quantities across every COMPLETED sale. */
    private int itemsSold;

    /** Sum of {@code netCashAmount} across COMPLETED sales - the same basis {@code takingsByPaymentMethod} sums on. */
    private BigDecimal grossTakings;

    private List<MyDayPaymentMethodDto> takingsByPaymentMethod;

    /** {@code grossTakings / saleCount}, zero when {@code saleCount == 0}. */
    private BigDecimal averageBasket;

    private MyDayDiscountsDto discountsGiven;

    private MyDayTradeInSummaryDto tradeInsProcessed;

    /** Sum of {@code storeCreditRedeemed} across COMPLETED sales. */
    private BigDecimal storeCreditRedeemed;

    private MyDayVoidedSalesDto voidedSales;

    private MyDayRepairPaymentsDto repairPaymentsCollected;

    /** See this class's javadoc for the exact formula. */
    private BigDecimal expectedCashInDrawer;

    /** Drill-down: every sale (COMPLETED and VOIDED) created by this cashier on this date. */
    private List<MyDaySaleDto> sales;
}
