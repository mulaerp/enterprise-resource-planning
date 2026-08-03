package com.mulaerp.publicapi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * {@link #id} (WEBSHOP frontend addition): needed by the storefront's postal trade-in quote
 * request free-text + category fallback path ({@code RequestTradeInQuoteRequest.categoryId} is
 * {@code UUID}-typed) - see {@code ProductRepository#countActiveProductsByCategory}'s javadoc.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublicCategoryDto {
    private UUID id;
    private String name;
    private long count;
}
