package com.mulaerp.accounting.dto;

import com.mulaerp.accounting.entity.JournalEntry;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JournalEntryDTO {
    private UUID id;
    private String entryNumber;
    private LocalDate entryDate;
    private String description;
    private JournalEntry.JournalEntryStatus status;
    private String reference;
    private List<JournalEntryLineDTO> lines;

    public static JournalEntryDTO fromEntity(JournalEntry entry) {
        JournalEntryDTO dto = new JournalEntryDTO();
        dto.setId(entry.getId());
        dto.setEntryNumber(entry.getEntryNumber());
        dto.setEntryDate(entry.getEntryDate());
        dto.setDescription(entry.getDescription());
        dto.setStatus(entry.getStatus());
        dto.setReference(entry.getReference());
        dto.setLines(entry.getLines().stream()
            .map(JournalEntryLineDTO::fromEntity)
            .collect(Collectors.toList()));
        return dto;
    }
}
