package com.mulaerp.product.repository;

import com.mulaerp.product.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {
    List<ProductCategory> findByDeletedFalse();
    List<ProductCategory> findByParentIsNullAndDeletedFalse();
}
