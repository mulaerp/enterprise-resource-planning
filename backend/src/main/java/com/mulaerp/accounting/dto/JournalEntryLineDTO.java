package com.mulaerp.accounting.dto;

import com.mulaerp.accounting.entity.JournalEntryLine;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JournalEntryLineDTO {
    private UUID id;
    private UUID accountId;
    private String accountCode;
    private String accountName;
    private BigDecimal debit;
    private BigDecimal credit;
    private String description;

    public static JournalEntryLineDTO fromEntity(JournalEntryLine line) {
        JournalEntryLineDTO dto = new JournalEntryLineDTO();
        dto.setId(line.getId());
        dto.setAccountId(line.getAccount().getId());
        dto.setAccountCode(line.getAccount().getCode());
        dto.setAccountName(line.getAccount().getName());
        dto.setDebit(line.getDebit());
        dto.setCredit(line.getCredit());
        dto.setDescription(line.getDescription());
        return dto;
    }
}
