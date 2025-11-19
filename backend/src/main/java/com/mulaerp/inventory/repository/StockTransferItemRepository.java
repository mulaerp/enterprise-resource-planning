package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.StockTransferItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StockTransferItemRepository extends JpaRepository<StockTransferItem, UUID> {

    List<StockTransferItem> findByStockTransferId(UUID stockTransferId);

    List<StockTransferItem> findByProductId(UUID productId);
}
