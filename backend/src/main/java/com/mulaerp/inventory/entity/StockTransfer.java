package com.mulaerp.inventory.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "stock_transfers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class StockTransfer extends BaseEntity {

    @Column(name = "transfer_number", nullable = false, unique = true, length = 100)
    private String transferNumber;

    @Column(name = "from_warehouse_id", nullable = false)
    private UUID fromWarehouseId;

    @Column(name = "to_warehouse_id", nullable = false)
    private UUID toWarehouseId;

    @Column(name = "transfer_date", nullable = false)
    private LocalDate transferDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TransferStatus status = TransferStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "stockTransfer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StockTransferItem> items = new ArrayList<>();

    public enum TransferStatus {
        PENDING,
        IN_TRANSIT,
        COMPLETED,
        CANCELLED
    }

    public void addItem(StockTransferItem item) {
        items.add(item);
        item.setStockTransfer(this);
    }

    public void removeItem(StockTransferItem item) {
        items.remove(item);
        item.setStockTransfer(null);
    }
}
