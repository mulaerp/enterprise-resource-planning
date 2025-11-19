package com.mulaerp.sales.repository;

import com.mulaerp.sales.entity.SalesOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SalesOrderRepository extends JpaRepository<SalesOrder, String> {

    Optional<SalesOrder> findByOrderNumber(String orderNumber);

    @Query("SELECT so FROM SalesOrder so " +
           "LEFT JOIN FETCH so.customer c " +
           "WHERE so.deletedAt IS NULL " +
           "AND (LOWER(so.orderNumber) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<SalesOrder> searchSalesOrders(@Param("search") String search, Pageable pageable);

    @Query("SELECT so FROM SalesOrder so " +
           "LEFT JOIN FETCH so.customer " +
           "LEFT JOIN FETCH so.items " +
           "WHERE so.id = :id AND so.deletedAt IS NULL")
    Optional<SalesOrder> findByIdWithDetails(@Param("id") String id);

    @Query("SELECT COUNT(so) FROM SalesOrder so WHERE so.deletedAt IS NULL")
    long countActive();

    @Query("SELECT COUNT(so) FROM SalesOrder so WHERE so.status = :status AND so.deletedAt IS NULL")
    Long countByStatus(@Param("status") String status);
}
