package com.mulaerp.product.repository;

import com.mulaerp.product.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {
    Page<Product> findByDeletedFalse(Pageable pageable);
    
    Optional<Product> findByIdAndDeletedFalse(UUID id);
    
    Optional<Product> findBySkuAndDeletedFalse(String sku);
    
    @Query("SELECT p FROM Product p WHERE p.deleted = false AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Product> searchProducts(@Param("search") String search, Pageable pageable);
    
    @Query("SELECT p FROM Product p WHERE p.deleted = false AND p.stockQuantity <= p.reorderLevel")
    Page<Product> findLowStockProducts(Pageable pageable);

    /**
     * PUBLIC-API: category id + name + product count, for active (non-deleted, status=ACTIVE)
     * products only - backs GET /public/categories per the public storefront contract.
     *
     * <p>WEBSHOP frontend addition: {@code p.category.id} was added to the select/group-by
     * (previously name-only) so the storefront's postal trade-in quote request
     * (POST /public/shop/quotes) can supply a real {@code categoryId} for its free-text +
     * category fallback path - {@code RequestTradeInQuoteRequest.categoryId} is
     * {@code UUID}-typed with no name-based alternative. Row shape is now
     * {@code [UUID id, String name, Long count]}; see
     * {@code PublicCatalogService#getCategories} for the one call site.
     */
    @Query("SELECT p.category.id, p.category.name, COUNT(p) FROM Product p " +
           "WHERE p.deleted = false AND p.status = 'ACTIVE' AND p.category IS NOT NULL " +
           "GROUP BY p.category.id, p.category.name")
    List<Object[]> countActiveProductsByCategory();

    /**
     * V38: whether the pg_trgm extension is enabled on this database - checked once at startup by
     * TradeInSuggestionService and cached, since CREATE EXTENSION in V38 is best-effort (wrapped in
     * a DO block that swallows failure rather than blocking the migration - see that file).
     */
    @Query(value = "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')", nativeQuery = true)
    boolean isPgTrgmExtensionInstalled();

    /**
     * V38 - GET /pos/trade-ins/suggest primary path: ranks active, non-deleted products by trigram
     * similarity of the query text against both name and SKU (whichever scores higher), using the
     * GIN index V38 creates on products.name. minSimilarity filters out near-zero matches so an
     * unrelated query returns no candidates rather than a padded-out top-N of noise.
     */
    @Query(value = "SELECT p.id AS id, p.sku AS sku, p.name AS name, p.category_id AS categoryId, " +
            "p.unit_price AS unitPrice, p.buy_price AS buyPrice, p.acquisition_cost AS acquisitionCost, " +
            "GREATEST(similarity(p.name, :q), similarity(p.sku, :q)) AS score " +
            "FROM products p " +
            "WHERE p.deleted = false AND p.status = 'ACTIVE' " +
            "AND GREATEST(similarity(p.name, :q), similarity(p.sku, :q)) >= :minSimilarity " +
            "ORDER BY score DESC " +
            "LIMIT :limit",
            nativeQuery = true)
    List<TrigramMatch> searchByTrigramSimilarity(@Param("q") String q, @Param("minSimilarity") double minSimilarity,
                                                  @Param("limit") int limit);

    /** Interface projection backing {@link #searchByTrigramSimilarity} - property names must match
     * the native query's column aliases (case-insensitively) for Spring Data to bind them. */
    interface TrigramMatch {
        UUID getId();
        String getSku();
        String getName();
        UUID getCategoryId();
        BigDecimal getUnitPrice();
        BigDecimal getBuyPrice();
        BigDecimal getAcquisitionCost();
        Double getScore();
    }
}
