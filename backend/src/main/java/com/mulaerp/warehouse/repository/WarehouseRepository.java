package com.mulaerp.warehouse.repository;

import com.mulaerp.warehouse.entity.Warehouse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {

    Page<Warehouse> findByDeletedFalse(Pageable pageable);

    Optional<Warehouse> findByIdAndDeletedFalse(UUID id);

    Optional<Warehouse> findByCodeAndDeletedFalse(String code);

    boolean existsByCodeAndDeletedFalse(String code);

    @Query("SELECT w FROM Warehouse w WHERE w.deleted = false AND " +
           "(LOWER(w.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(w.location) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Warehouse> searchWarehouses(@Param("search") String search, Pageable pageable);
}
