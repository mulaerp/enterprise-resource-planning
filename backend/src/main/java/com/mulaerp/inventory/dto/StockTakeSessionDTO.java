package com.mulaerp.inventory.dto;

import com.mulaerp.inventory.entity.StockTakeSession;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockTakeSessionDTO {
    private UUID id;
    private String sessionNumber;
    private UUID warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private StockTakeSession.StockTakeStatus status;
    private LocalDateTime openedAt;
    private LocalDateTime approvedAt;
    private String approvedBy;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Summary counts - see StockTakeService#toDto. */
    private long totalLines;
    private long countedLines;
    private long varianceLines;

    public static StockTakeSessionDTO fromEntity(StockTakeSession session) {
        StockTakeSessionDTO dto = new StockTakeSessionDTO();
        dto.setId(session.getId());
        dto.setSessionNumber(session.getSessionNumber());
        dto.setWarehouseId(session.getWarehouseId());
        dto.setStatus(session.getStatus());
        dto.setOpenedAt(session.getOpenedAt());
        dto.setApprovedAt(session.getApprovedAt());
        dto.setApprovedBy(session.getApprovedBy());
        dto.setNotes(session.getNotes());
        dto.setCreatedAt(session.getCreatedAt());
        dto.setUpdatedAt(session.getUpdatedAt());
        return dto;
    }
}
