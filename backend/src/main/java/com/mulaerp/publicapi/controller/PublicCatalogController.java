package com.mulaerp.publicapi.controller;

import com.mulaerp.publicapi.dto.PublicCategoryDto;
import com.mulaerp.publicapi.dto.PublicProductDto;
import com.mulaerp.publicapi.service.PublicCatalogService;
import com.mulaerp.util.PageSizeCap;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * PUBLIC-API: anonymous (permitAll, see SecurityConfig's "/api/v1/public/**" matcher) storefront
 * endpoints for the B2C catalogue (SHOP). Never returns acquisitionCost, costPrice, the raw
 * stockQuantity number, or any internal id beyond sku - see PublicCatalogService#toPublicDto.
 */
@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicCatalogController {

    private final PublicCatalogService publicCatalogService;

    @GetMapping("/catalog")
    public ResponseEntity<Page<PublicProductDto>> getCatalog(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String condition,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("name").ascending());
        return ResponseEntity.ok(publicCatalogService.getCatalog(search, category, condition, pageable));
    }

    @GetMapping("/catalog/{sku}")
    public ResponseEntity<PublicProductDto> getBySku(@PathVariable String sku) {
        return ResponseEntity.ok(publicCatalogService.getBySku(sku));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<PublicCategoryDto>> getCategories() {
        return ResponseEntity.ok(publicCatalogService.getCategories());
    }
}
