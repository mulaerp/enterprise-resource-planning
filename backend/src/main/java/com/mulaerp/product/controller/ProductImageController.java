package com.mulaerp.product.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.product.dto.ProductDto;
import com.mulaerp.product.service.ProductImageService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * WP: product images (zero-copyright defaults). Upload is authenticated and mirrors the CSV
 * import endpoints' role gating (ADMIN/MANAGER); the GET is anonymous under the existing
 * "/api/v1/public/**" permitAll matcher in SecurityConfig - no security config change needed.
 */
@RestController
@RequiredArgsConstructor
public class ProductImageController {

    private final ProductImageService productImageService;

    @PostMapping(value = "/api/v1/products/{id}/image", consumes = "multipart/form-data")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Upload a product photo",
            description = "Multipart field name 'file'. Allowed types: jpg, jpeg, png, webp "
                    + "(by extension). Size cap ~5MB. Replaces any previously uploaded photo for "
                    + "this product. Returns the updated product, including the new imageUrl.")
    public ResponseEntity<ProductDto> uploadProductImage(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file
    ) {
        ProductDto product = productImageService.storeProductImage(id, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(product);
    }

    @GetMapping("/api/v1/public/images/{filename}")
    @Operation(summary = "Serve an uploaded product photo",
            description = "Anonymous, cacheable. 404 if the filename doesn't resolve to a stored "
                    + "image; 400 for a malformed/traversal-shaped filename.")
    public ResponseEntity<byte[]> getProductImage(@PathVariable String filename) {
        return productImageService.loadImage(filename)
                .map(image -> ResponseEntity.ok()
                        .contentType(image.contentType() != null ? image.contentType() : MediaType.APPLICATION_OCTET_STREAM)
                        .cacheControl(org.springframework.http.CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                        .body(image.content()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
