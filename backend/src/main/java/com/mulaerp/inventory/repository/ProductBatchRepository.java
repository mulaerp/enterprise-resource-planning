package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.ProductBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductBatchRepository extends JpaRepository<ProductBatch, UUID> {

    Optional<ProductBatch> findByBatchNumber(String batchNumber);

    List<ProductBatch> findByProductId(UUID productId);

    List<ProductBatch> findByProductIdAndStatus(UUID productId, ProductBatch.BatchStatus status);

    @Query("SELECT pb FROM ProductBatch pb WHERE pb.expiryDate <= :date AND pb.status = 'ACTIVE'")
    List<ProductBatch> findExpiringBatches(@Param("date") LocalDate date);

    @Query("SELECT pb FROM ProductBatch pb WHERE pb.expiryDate < :date AND pb.status = 'ACTIVE'")
    List<ProductBatch> findExpiredBatches(@Param("date") LocalDate date);

    @Query("SELECT pb FROM ProductBatch pb WHERE pb.product.id = :productId AND pb.status = 'ACTIVE' ORDER BY pb.expiryDate ASC")
    List<ProductBatch> findActiveByProductOrderByExpiryDate(@Param("productId") UUID productId);

    boolean existsByBatchNumber(String batchNumber);
}
