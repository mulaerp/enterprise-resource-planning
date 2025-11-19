package com.mulaerp.purchase.repository;

import com.mulaerp.purchase.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    Optional<PurchaseOrder> findByPoNumber(String poNumber);

    @Query("SELECT po FROM PurchaseOrder po WHERE " +
            "LOWER(po.poNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(po.supplier.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<PurchaseOrder> searchPurchaseOrders(@Param("search") String search, Pageable pageable);

    Page<PurchaseOrder> findByStatus(PurchaseOrder.PurchaseOrderStatus status, Pageable pageable);
}
