package com.mulaerp.product.repository;

import com.mulaerp.product.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {
    List<ProductCategory> findByDeletedFalse();
    List<ProductCategory> findByParentIsNullAndDeletedFalse();

    // WP10: used by the CSV product importer to resolve/auto-create a category by its plain name.
    Optional<ProductCategory> findByNameIgnoreCaseAndDeletedFalse(String name);
}
