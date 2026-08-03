package com.mulaerp.product.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Product extends BaseEntity {
    
    @Column(nullable = false, unique = true, length = 100)
    private String sku;
    
    @Column(nullable = false)
    private String name;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ProductCategory category;
    
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;
    
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal costPrice = BigDecimal.ZERO;
    
    @Column(nullable = false)
    private Integer stockQuantity = 0;
    
    @Column(nullable = false)
    private Integer reorderLevel = 0;
    
    @Column(nullable = false, length = 50)
    private String status = "ACTIVE";

    // --- Thrift-store fields (WP: PoS flagship feature) ---------------------------------
    // All optional/nullable so existing product flows (create/update without these fields)
    // continue to work unchanged.

    /** One of NEW, LIKE_NEW, GOOD, FAIR, POOR - validated in ProductService, not at the DB layer. */
    @Column(length = 20)
    private String condition;

    /** What the store paid to acquire this item; used as the COGS snapshot on PoS sale lines. */
    @Column(name = "acquisition_cost", precision = 15, scale = 2)
    private BigDecimal acquisitionCost;

    /** Comma-separated tag list, stored as plain TEXT and exposed as List<String> in ProductDto. */
    @Column(columnDefinition = "TEXT")
    private String tags;

    @Column(columnDefinition = "TEXT")
    private String accessories;

    @Column(name = "has_box")
    private Boolean hasBox;

    // --- REPAIR/WARRANTY + public storefront fields ------------------------------------
    // Both nullable/optional: warrantyMonths null means "no in-house warranty issued for this
    // product"; buyPrice null means "we don't buy this" on the public storefront's sell-us view.

    /** Months of in-house warranty auto-issued per unit sold - see WarrantyService. */
    @Column(name = "warranty_months")
    private Integer warrantyMonths;

    /** What the storefront advertises paying to acquire this item from a customer (buyPrice != acquisitionCost). */
    @Column(name = "buy_price", precision = 15, scale = 2)
    private BigDecimal buyPrice;

    // --- Product images (WP: zero-copyright product photos) ----------------------------
    // Nullable: null means "no photo uploaded yet" - both PublicCatalogService and the staff
    // ProductService leave this as-is and let the frontend fall back to a category placeholder.
    // Set exclusively by ProductImageService#storeProductImage (see ProductImageController);
    // holds the public GET path (e.g. "/api/v1/public/images/{filename}"), never a raw filesystem path.
    @Column(name = "image_url", length = 500)
    private String imageUrl;
}
