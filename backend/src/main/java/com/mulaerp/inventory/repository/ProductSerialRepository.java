package com.mulaerp.inventory.repository;

import com.mulaerp.inventory.entity.ProductSerial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductSerialRepository extends JpaRepository<ProductSerial, UUID> {

    Optional<ProductSerial> findBySerialNumber(String serialNumber);

    List<ProductSerial> findByProductId(UUID productId);

    List<ProductSerial> findByProductIdAndStatus(UUID productId, ProductSerial.SerialStatus status);

    List<ProductSerial> findByCustomerId(UUID customerId);

    List<ProductSerial> findBySalesOrderId(UUID salesOrderId);

    List<ProductSerial> findByStatus(ProductSerial.SerialStatus status);

    @Query("SELECT ps FROM ProductSerial ps WHERE ps.warrantyExpiryDate <= :date AND ps.status = 'SOLD'")
    List<ProductSerial> findWarrantyExpiring(@Param("date") LocalDate date);

    @Query("SELECT ps FROM ProductSerial ps WHERE ps.warrantyExpiryDate < :date AND ps.status = 'SOLD'")
    List<ProductSerial> findWarrantyExpired(@Param("date") LocalDate date);

    boolean existsBySerialNumber(String serialNumber);

    long countByProductIdAndStatus(UUID productId, ProductSerial.SerialStatus status);
}
