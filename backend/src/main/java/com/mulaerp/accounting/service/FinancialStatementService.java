package com.mulaerp.accounting.service;

import com.mulaerp.accounting.dto.BalanceSheetDTO;
import com.mulaerp.accounting.dto.FinancialLineItemDTO;
import com.mulaerp.accounting.dto.ProfitLossDTO;
import com.mulaerp.accounting.entity.Account;
import com.mulaerp.accounting.entity.JournalEntry;
import com.mulaerp.accounting.repository.AccountRepository;
import com.mulaerp.accounting.repository.JournalEntryLineRepository;
import com.mulaerp.accounting.repository.JournalEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds the Profit &amp; Loss and Balance Sheet reports directly from POSTED journal entry
 * lines (draft/cancelled entries are never included). Amounts are normalised to each account
 * type's normal balance side, so revenue, expenses, assets, liabilities and equity all report
 * as positive numbers when in their expected position.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinancialStatementService {

    private final AccountRepository accountRepository;
    private final JournalEntryLineRepository journalEntryLineRepository;
    private final JournalEntryRepository journalEntryRepository;

    public ProfitLossDTO getProfitAndLoss(LocalDate startDate, LocalDate endDate) {
        Map<UUID, BigDecimal[]> activity =
                toActivityMap(journalEntryLineRepository.sumActivityByAccountBetweenDates(startDate, endDate));

        List<Account> revenueAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.REVENUE);
        List<Account> expenseAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.EXPENSE);

        // Revenue's normal balance is credit; expense's normal balance is debit.
        List<FinancialLineItemDTO> revenue = buildLineItems(revenueAccounts, activity, false);
        List<FinancialLineItemDTO> expenses = buildLineItems(expenseAccounts, activity, true);

        BigDecimal totalRevenue = sum(revenue);
        BigDecimal totalExpenses = sum(expenses);

        ProfitLossDTO dto = new ProfitLossDTO();
        dto.setStartDate(startDate);
        dto.setEndDate(endDate);
        dto.setRevenue(revenue);
        dto.setExpenses(expenses);
        dto.setTotalRevenue(totalRevenue);
        dto.setTotalExpenses(totalExpenses);
        dto.setNetIncome(totalRevenue.subtract(totalExpenses));
        dto.setDraftEntriesInPeriod(journalEntryRepository.countByStatusAndEntryDateBetweenAndDeletedFalse(
                JournalEntry.JournalEntryStatus.DRAFT, startDate, endDate));
        return dto;
    }

    public BalanceSheetDTO getBalanceSheet(LocalDate asOfDate) {
        Map<UUID, BigDecimal[]> activity =
                toActivityMap(journalEntryLineRepository.sumActivityByAccountUpToDate(asOfDate));

        List<Account> assetAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.ASSET);
        List<Account> liabilityAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.LIABILITY);
        List<Account> equityAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.EQUITY);
        List<Account> revenueAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.REVENUE);
        List<Account> expenseAccounts = accountRepository.findByAccountTypeAndDeletedFalse(Account.AccountType.EXPENSE);

        // Asset's normal balance is debit; liability/equity's normal balance is credit.
        List<FinancialLineItemDTO> assets = buildLineItems(assetAccounts, activity, true);
        List<FinancialLineItemDTO> liabilities = buildLineItems(liabilityAccounts, activity, false);
        List<FinancialLineItemDTO> equity = buildLineItems(equityAccounts, activity, false);

        BigDecimal totalAssets = sum(assets);
        BigDecimal totalLiabilities = sum(liabilities);
        BigDecimal totalEquityAccounts = sum(equity);

        // Retained earnings = cumulative net income (all POSTED revenue/expense activity up to
        // asOfDate) that has not been closed into an equity account yet. Folding it into
        // totalEquity keeps the fundamental accounting equation (Assets = Liabilities + Equity)
        // balanced even though no closing entries have been posted.
        BigDecimal cumulativeRevenue = sumAccountType(revenueAccounts, activity, false);
        BigDecimal cumulativeExpenses = sumAccountType(expenseAccounts, activity, true);
        BigDecimal retainedEarnings = cumulativeRevenue.subtract(cumulativeExpenses);

        BigDecimal totalEquity = totalEquityAccounts.add(retainedEarnings);

        BalanceSheetDTO dto = new BalanceSheetDTO();
        dto.setAsOfDate(asOfDate);
        dto.setAssets(assets);
        dto.setLiabilities(liabilities);
        dto.setEquity(equity);
        dto.setTotalAssets(totalAssets);
        dto.setTotalLiabilities(totalLiabilities);
        dto.setTotalEquity(totalEquity);
        dto.setRetainedEarnings(retainedEarnings);
        dto.setDraftEntriesInPeriod(journalEntryRepository.countByStatusAndEntryDateLessThanEqualAndDeletedFalse(
                JournalEntry.JournalEntryStatus.DRAFT, asOfDate));
        return dto;
    }

    // ============================================
    // Helpers
    // ============================================

    private BigDecimal computeAmount(Account account, Map<UUID, BigDecimal[]> activity, boolean debitNormal) {
        BigDecimal[] debitCredit = activity.get(account.getId());
        if (debitCredit == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal debit = debitCredit[0];
        BigDecimal credit = debitCredit[1];
        return debitNormal ? debit.subtract(credit) : credit.subtract(debit);
    }

    private List<FinancialLineItemDTO> buildLineItems(List<Account> accounts, Map<UUID, BigDecimal[]> activity,
                                                        boolean debitNormal) {
        List<FinancialLineItemDTO> items = new ArrayList<>();
        for (Account account : accounts) {
            BigDecimal amount = computeAmount(account, activity, debitNormal);
            if (amount.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }
            items.add(new FinancialLineItemDTO(account.getCode(), account.getName(), amount));
        }
        items.sort(Comparator.comparing(FinancialLineItemDTO::getAccountCode));
        return items;
    }

    private BigDecimal sumAccountType(List<Account> accounts, Map<UUID, BigDecimal[]> activity, boolean debitNormal) {
        BigDecimal total = BigDecimal.ZERO;
        for (Account account : accounts) {
            total = total.add(computeAmount(account, activity, debitNormal));
        }
        return total;
    }

    private BigDecimal sum(List<FinancialLineItemDTO> items) {
        BigDecimal total = BigDecimal.ZERO;
        for (FinancialLineItemDTO item : items) {
            total = total.add(item.getAmount());
        }
        return total;
    }

    private Map<UUID, BigDecimal[]> toActivityMap(List<Object[]> rows) {
        Map<UUID, BigDecimal[]> map = new HashMap<>();
        for (Object[] row : rows) {
            UUID accountId = (UUID) row[0];
            BigDecimal debit = (BigDecimal) row[1];
            BigDecimal credit = (BigDecimal) row[2];
            map.put(accountId, new BigDecimal[]{debit, credit});
        }
        return map;
    }
}
