package com.mulaerp.publicapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * PUBLIC-API: the storefront-safe view of a Product. Deliberately excludes acquisitionCost and
 * costPrice - see PublicCatalogService#toPublicDto, which is the only place this DTO is
 * populated.
 *
 * <p>{@link #id} (WEBSHOP frontend addition): the storefront's cart/checkout flow
 * (POST /api/v1/public/shop/orders, POST /api/v1/public/shop/quotes) requires the product's real
 * UUID id, not just its sku - {@code ShopOrderLineRequest.productId}/
 * {@code RequestTradeInQuoteRequest.productId} are both {@code @NotNull UUID}, with no
 * sku-based alternative, and every other public catalogue field (sku, name, price, stock status)
 * is already anonymous-safe, so exposing this opaque row id carries no incremental information
 * beyond what {@code GET /public/catalog}/{@code /public/catalog/{sku}} already reveal about the
 * same product. Added narrowly (this DTO + its one populating line in
 * {@code PublicCatalogService#toPublicDto} only) to unblock that otherwise-impossible checkout
 * wiring - see the WEBSHOP frontend report for the full rationale.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublicProductDto {
    private UUID id;
    private String sku;
    private String name;
    private String category;
    private String condition;
    private List<String> tags;
    private BigDecimal sellPrice;
    private BigDecimal buyPrice;
    private String stockStatus;
    private Boolean hasBox;
    private String accessories;

    /** Public GET path (e.g. "/api/v1/public/images/{filename}"), or null if no photo uploaded. */
    private String imageUrl;
}
