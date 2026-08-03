package com.mulaerp.accounting.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Body for POST /accounting/journal-entries/post-batch. Either {@code entryIds} (an explicit
 * selection, e.g. from the drafts preview screen's checkboxes) or {@code startDate}/{@code
 * endDate} (post every DRAFT in the range) must be supplied - entryIds takes precedence when
 * both are present. See AccountingService#postBatch for the all-or-nothing posting semantics.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PostBatchRequest {
    private List<UUID> entryIds;
    private LocalDate startDate;
    private LocalDate endDate;
}
