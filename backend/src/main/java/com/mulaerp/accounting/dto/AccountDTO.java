package com.mulaerp.accounting.dto;

import com.mulaerp.accounting.entity.Account;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountDTO {
    private UUID id;
    private String code;
    private String name;
    private Account.AccountType accountType;
    private UUID parentId;
    private BigDecimal balance;
    private Boolean isActive;
    private String description;

    public static AccountDTO fromEntity(Account account) {
        AccountDTO dto = new AccountDTO();
        dto.setId(account.getId());
        dto.setCode(account.getCode());
        dto.setName(account.getName());
        dto.setAccountType(account.getAccountType());
        dto.setParentId(account.getParentId());
        dto.setBalance(account.getBalance());
        dto.setIsActive(account.getIsActive());
        dto.setDescription(account.getDescription());
        return dto;
    }
}
