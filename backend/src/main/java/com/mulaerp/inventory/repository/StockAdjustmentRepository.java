package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.StockAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, UUID> {
    
    Optional<StockAdjustment> findByAdjustmentNumberAndDeletedFalse(String adjustmentNumber);
    
    List<StockAdjustment> findByDeletedFalse();
    
    List<StockAdjustment> findByProductIdAndDeletedFalse(UUID productId);
}
