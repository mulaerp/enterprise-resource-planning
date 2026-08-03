package com.mulaerp.product.controller;

import com.mulaerp.product.dto.*;
import com.mulaerp.product.service.ProductService;
import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.util.PageSizeCap;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

// WP: five-role model - CASHIER may CREATE a product (thrift intake, RoleRules.PRODUCT_CREATE) but
// not update/delete/import (RoleRules.STOCK_WRITERS - INVENTORY owns the product master otherwise);
// every GET (including low-stock) stays open to any authenticated user.
@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<Page<ProductDto>> getAllProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        Sort sort = sortDir.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), sort);

        Page<ProductDto> products = search != null && !search.isEmpty()
                ? productService.searchProducts(search, pageable)
                : productService.getAllProducts(pageable);

        return ResponseEntity.ok(products);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductDto> getProductById(@PathVariable UUID id) {
        ProductDto product = productService.getProductById(id);
        return ResponseEntity.ok(product);
    }

    @PostMapping
    @PreAuthorize(RoleRules.PRODUCT_CREATE)
    public ResponseEntity<ProductDto> createProduct(@Valid @RequestBody CreateProductRequest request) {
        ProductDto product = productService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(product);
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    public ResponseEntity<ProductDto> updateProduct(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProductRequest request
    ) {
        ProductDto product = productService.updateProduct(id, request);
        return ResponseEntity.ok(product);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/categories")
    public ResponseEntity<List<ProductCategoryDto>> getAllCategories() {
        List<ProductCategoryDto> categories = productService.getAllCategories();
        return ResponseEntity.ok(categories);
    }
    
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize(RoleRules.STOCK_WRITERS)
    @Operation(summary = "Bulk import products from a CSV file",
            description = "Columns (case/whitespace-insensitive, any order): sku, name, category, "
                    + "costPrice, unitPrice, stockQuantity, condition (optional: NEW/LIKE_NEW/GOOD/"
                    + "FAIR/POOR), tags (optional, semicolon- or pipe-separated, e.g. \"jacket;denim\"), "
                    + "acquisitionCost (optional). A header row is required. Rows with an unparseable "
                    + "price/quantity are skipped and counted (not reported as errors). Rows that parse "
                    + "but fail validation are reported in `errors` (capped at 20, 1-based CSV line "
                    + "number). An existing SKU, or a SKU repeated within the file, is counted under "
                    + "`duplicates` rather than failing the row.")
    public ResponseEntity<ProductImportResultDTO> importProducts(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(productService.importProducts(file));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<Page<ProductDto>> getLowStockProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size));
        Page<ProductDto> products = productService.getLowStockProducts(pageable);
        return ResponseEntity.ok(products);
    }
}
