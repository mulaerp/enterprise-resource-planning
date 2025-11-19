package com.mulaerp.product.repository;

import com.mulaerp.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {
    Page<Product> findByDeletedFalse(Pageable pageable);
    
    Optional<Product> findByIdAndDeletedFalse(UUID id);
    
    Optional<Product> findBySkuAndDeletedFalse(String sku);
    
    @Query("SELECT p FROM Product p WHERE p.deleted = false AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Product> searchProducts(@Param("search") String search, Pageable pageable);
    
    @Query("SELECT p FROM Product p WHERE p.deleted = false AND p.stockQuantity <= p.reorderLevel")
    Page<Product> findLowStockProducts(Pageable pageable);
}
