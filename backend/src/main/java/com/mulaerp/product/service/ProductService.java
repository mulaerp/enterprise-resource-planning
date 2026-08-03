package com.mulaerp.product.service;

import com.mulaerp.product.dto.*;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.entity.ProductCategory;
import com.mulaerp.product.repository.ProductCategoryRepository;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import com.mulaerp.websocket.service.WebSocketService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private static final int MAX_IMPORT_ERRORS = 20;

    // Thrift-store field (WP: PoS flagship feature): allowed values for Product.condition.
    private static final Set<String> ALLOWED_CONDITIONS = Set.of("NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR");

    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final WebSocketService webSocketService;
    private final Validator validator;
    private final WarehouseService warehouseService;
    private final WarehouseStockService warehouseStockService;
    private final StockMovementService stockMovementService;

    @Transactional(readOnly = true)
    public Page<ProductDto> getAllProducts(Pageable pageable) {
        return productRepository.findByDeletedFalse(pageable)
                .map(this::convertToDto);
    }
    
    @Transactional(readOnly = true)
    public Page<ProductDto> searchProducts(String search, Pageable pageable) {
        return productRepository.searchProducts(search, pageable)
                .map(this::convertToDto);
    }
    
    @Cacheable(value = "products", key = "#id")
    @Transactional(readOnly = true)
    public ProductDto getProductById(UUID id) {
        Product product = productRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        return convertToDto(product);
    }

    /**
     * Evicts a single product's cached DTO. Needed because callers outside this service (e.g.
     * PosSaleService decrementing stock on a sale) mutate Product directly via ProductRepository
     * rather than through updateProduct/deleteProduct - without this, GET /products/{id} would
     * keep serving a stale cached stockQuantity after a PoS sale until the cache TTL expires.
     */
    @CacheEvict(value = "products", key = "#id")
    public void evictProductCache(UUID id) {
        // no-op body - the eviction is the point of this method
    }


    @CacheEvict(value = "products", allEntries = true)
    @Transactional
    public ProductDto createProduct(CreateProductRequest request) {
        // Check if SKU already exists
        if (productRepository.findBySkuAndDeletedFalse(request.getSku()).isPresent()) {
            throw new IllegalArgumentException("Product with SKU " + request.getSku() + " already exists");
        }
        
        Product product = new Product();
        product.setSku(request.getSku());
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setUnitPrice(request.getUnitPrice());
        product.setCostPrice(request.getCostPrice());
        product.setStockQuantity(request.getStockQuantity());
        product.setReorderLevel(request.getReorderLevel());
        product.setStatus(request.getStatus());
        applyThriftFields(product, request.getCondition(), request.getAcquisitionCost(),
                request.getTags(), request.getAccessories(), request.getHasBox());
        product.setWarrantyMonths(request.getWarrantyMonths());
        product.setBuyPrice(request.getBuyPrice());

        if (request.getCategoryId() != null) {
            ProductCategory category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            product.setCategory(category);
        }

        Product savedProduct = productRepository.save(product);

        // A brand-new product's stockQuantity (the denormalized total) was previously never
        // reflected in warehouse_stock, which is what PosSaleService/WarehouseStockService
        // actually check/decrement on a sale. That left every freshly created product unsellable
        // via PoS on its first sale - "Insufficient stock ... available 0, requested 1" - despite
        // the product list correctly showing stock on hand. Seed the default warehouse so the two
        // stay consistent from creation, same as how PosSaleService itself assumes a default
        // warehouse for stock movements.
        if (savedProduct.getStockQuantity() != null && savedProduct.getStockQuantity() > 0) {
            UUID defaultWarehouseId = warehouseService.getDefaultWarehouseId();
            warehouseStockService.applyDelta(defaultWarehouseId, savedProduct, savedProduct.getStockQuantity());

            // PROBLEM 2 fix (silent stock ledger bypass): opening stock on a brand-new product
            // used to move warehouse_stock/Product.stockQuantity with no StockMovement row at
            // all, so the ledger (and StockMovementController's reconcile endpoint) had no idea
            // the product ever had stock to begin with. Reuses ADJUSTMENT (no new movement type
            // needed) with a clear reference/notes so it reads distinctly from a manual
            // adjustment in the ledger UI.
            stockMovementService.recordMovement(savedProduct, defaultWarehouseId, StockMovement.MovementType.ADJUSTMENT,
                    savedProduct.getStockQuantity(), savedProduct.getSku(), "Opening stock");
        }

        return convertToDto(savedProduct);
    }

    @CacheEvict(value = "products", key = "#id")
    @Transactional
    public ProductDto updateProduct(UUID id, UpdateProductRequest request) {
        Product product = productRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        // WP12: the request re-fetches the entity fresh every time, so Hibernate's own @Version
        // check on the loaded row is always satisfied - it can't catch a client that's editing a
        // stale copy. Comparing the client-submitted version against the just-loaded entity's
        // version closes that gap: request.getVersion() is what the client last saw (from a
        // previous GET), product.getVersion() is the true current value. A null request version
        // means the caller doesn't participate in optimistic locking (kept for existing callers).
        if (request.getVersion() != null && !request.getVersion().equals(product.getVersion())) {
            throw new ObjectOptimisticLockingFailureException(Product.class, id);
        }

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setUnitPrice(request.getUnitPrice());
        product.setCostPrice(request.getCostPrice());
        // PROBLEM 2 fix (silent stock ledger bypass): stockQuantity is intentionally NOT applied
        // here anymore - it used to let anyone rewrite the authoritative total with no
        // StockMovement row and no warehouse_stock sync. request.getStockQuantity() is accepted
        // on the wire (kept on UpdateProductRequest for backward compatibility with callers that
        // still send the current value) but ignored server-side; stock changes must flow through
        // InventoryService adjustments (POST /inventory/adjustments) only.
        product.setReorderLevel(request.getReorderLevel());
        product.setStatus(request.getStatus());
        applyThriftFields(product, request.getCondition(), request.getAcquisitionCost(),
                request.getTags(), request.getAccessories(), request.getHasBox());
        product.setWarrantyMonths(request.getWarrantyMonths());
        product.setBuyPrice(request.getBuyPrice());

        if (request.getCategoryId() != null) {
            ProductCategory category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }

        // WP12: saveAndFlush (not save) so the version bump Hibernate applies for this UPDATE is
        // visible on `product` before convertToDto() reads it below - plain save() only flushes at
        // transaction commit (after this method has already returned its DTO), which would leave
        // the response reporting the pre-increment version even though the DB row was updated.
        Product updatedProduct = productRepository.saveAndFlush(product);

        // Check for low stock and send WebSocket notification (Phase 6.7)
        checkAndNotifyLowStock(updatedProduct);
        
        return convertToDto(updatedProduct);
    }
    
    private void checkAndNotifyLowStock(Product product) {
        if (product.getStockQuantity() <= product.getReorderLevel()) {
            webSocketService.notifyLowStock(convertToDto(product));
        }
    }
    
    @CacheEvict(value = "products", key = "#id")
    @Transactional
    public void deleteProduct(UUID id) {
        Product product = productRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        product.setDeleted(true);
        product.setDeletedAt(LocalDateTime.now());
        productRepository.save(product);
    }
    
    /**
     * WP10: bulk-imports products from a CSV file, reusing {@link #createProduct} (and therefore
     * the same SKU-uniqueness rule and thrift-field validation) for every row - never raw SQL.
     * Tolerant, mirroring {@code BankStatementParser}: rows with an unparseable price/quantity are
     * silently skipped and counted (see {@link ProductCsvParser}); rows that parse but fail
     * validation, or collide with an existing/already-seen SKU, are reported back instead of
     * aborting the rest of the file.
     */
    @CacheEvict(value = {"products", "categories"}, allEntries = true)
    @Transactional
    public ProductImportResultDTO importProducts(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("CSV file is required");
        }

        ProductCsvParser.ParseResult parseResult;
        try {
            parseResult = new ProductCsvParser().parse(file.getInputStream());
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read CSV file: " + e.getMessage());
        }

        int imported = 0;
        int duplicates = 0;
        List<ProductImportResultDTO.ImportRowError> errors = new ArrayList<>();
        Set<String> skusSeenThisBatch = new HashSet<>();

        for (ProductCsvParser.ParsedRow row : parseResult.getRows()) {
            String sku = row.sku();

            if (!skusSeenThisBatch.add(sku) || productRepository.findBySkuAndDeletedFalse(sku).isPresent()) {
                duplicates++;
                continue;
            }

            try {
                CreateProductRequest request = new CreateProductRequest();
                request.setSku(sku);
                request.setName(row.name());
                request.setUnitPrice(row.unitPrice());
                request.setCostPrice(row.costPrice());
                request.setStockQuantity(row.stockQuantity());
                request.setReorderLevel(0);
                request.setStatus("ACTIVE");
                request.setCondition(row.condition());
                request.setAcquisitionCost(row.acquisitionCost());
                request.setTags(row.tags());
                request.setBuyPrice(row.buyPrice());
                request.setWarrantyMonths(row.warrantyMonths());

                if (row.categoryName() != null) {
                    request.setCategoryId(resolveOrCreateCategory(row.categoryName()).getId());
                }

                Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);
                if (!violations.isEmpty()) {
                    String message = violations.stream()
                            .map(ConstraintViolation::getMessage)
                            .collect(Collectors.joining("; "));
                    addError(errors, row.lineNumber(), message);
                    continue;
                }

                createProduct(request);
                imported++;
            } catch (Exception e) {
                addError(errors, row.lineNumber(), e.getMessage());
            }
        }

        log.info("[ProductImport] {} imported, {} skipped, {} duplicates, {} error row(s)",
                imported, parseResult.getSkipped(), duplicates, errors.size());

        return new ProductImportResultDTO(imported, parseResult.getSkipped(), duplicates, errors);
    }

    /** WP10: CSV imports reference categories by plain name; unknown names are auto-created. */
    private ProductCategory resolveOrCreateCategory(String categoryName) {
        return categoryRepository.findByNameIgnoreCaseAndDeletedFalse(categoryName)
                .orElseGet(() -> {
                    ProductCategory category = new ProductCategory();
                    category.setName(categoryName);
                    return categoryRepository.save(category);
                });
    }

    private void addError(List<ProductImportResultDTO.ImportRowError> errors, int lineNumber, String message) {
        if (errors.size() < MAX_IMPORT_ERRORS) {
            errors.add(new ProductImportResultDTO.ImportRowError(lineNumber, message));
        }
    }

    @Cacheable(value = "categories")
    @Transactional(readOnly = true)
    public List<ProductCategoryDto> getAllCategories() {
        return categoryRepository.findByDeletedFalse().stream()
                .map(this::convertCategoryToDto)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public Page<ProductDto> getLowStockProducts(Pageable pageable) {
        return productRepository.findLowStockProducts(pageable)
                .map(this::convertToDto);
    }
    
    /**
     * Applies the optional thrift-store fields (WP: PoS flagship feature) to a Product being
     * created or updated. All fields are optional - a null value leaves the corresponding
     * Product field untouched (so PUT with these fields omitted does not wipe them), except
     * tags which uses an explicit empty list to mean "clear tags" vs. null meaning "leave as is".
     */
    private void applyThriftFields(Product product, String condition, java.math.BigDecimal acquisitionCost,
                                    List<String> tags, String accessories, Boolean hasBox) {
        if (condition != null) {
            String normalized = condition.trim().toUpperCase();
            if (!ALLOWED_CONDITIONS.contains(normalized)) {
                throw new IllegalArgumentException(
                        "Invalid condition: " + condition + ". Must be one of " + ALLOWED_CONDITIONS);
            }
            product.setCondition(normalized);
        }
        if (acquisitionCost != null) {
            product.setAcquisitionCost(acquisitionCost);
        }
        if (tags != null) {
            product.setTags(tags.isEmpty() ? null : String.join(",", tags));
        }
        if (accessories != null) {
            product.setAccessories(accessories);
        }
        if (hasBox != null) {
            product.setHasBox(hasBox);
        }
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(t -> !t.isEmpty())
                .collect(Collectors.toList());
    }

    private ProductDto convertToDto(Product product) {
        ProductDto dto = new ProductDto();
        dto.setId(product.getId());
        dto.setSku(product.getSku());
        dto.setName(product.getName());
        dto.setDescription(product.getDescription());
        dto.setUnitPrice(product.getUnitPrice());
        dto.setCostPrice(product.getCostPrice());
        dto.setStockQuantity(product.getStockQuantity());
        dto.setReorderLevel(product.getReorderLevel());
        dto.setStatus(product.getStatus());
        dto.setCreatedAt(product.getCreatedAt());
        dto.setUpdatedAt(product.getUpdatedAt());
        dto.setVersion(product.getVersion());
        dto.setCondition(product.getCondition());
        dto.setAcquisitionCost(product.getAcquisitionCost());
        dto.setTags(parseTags(product.getTags()));
        dto.setAccessories(product.getAccessories());
        dto.setHasBox(product.getHasBox());
        dto.setWarrantyMonths(product.getWarrantyMonths());
        dto.setBuyPrice(product.getBuyPrice());
        dto.setImageUrl(product.getImageUrl());

        if (product.getCategory() != null) {
            dto.setCategoryId(product.getCategory().getId());
            dto.setCategoryName(product.getCategory().getName());
        }

        return dto;
    }
    
    private ProductCategoryDto convertCategoryToDto(ProductCategory category) {
        ProductCategoryDto dto = new ProductCategoryDto();
        dto.setId(category.getId());
        dto.setName(category.getName());
        dto.setDescription(category.getDescription());
        dto.setCreatedAt(category.getCreatedAt());
        dto.setUpdatedAt(category.getUpdatedAt());
        
        if (category.getParent() != null) {
            dto.setParentId(category.getParent().getId());
            dto.setParentName(category.getParent().getName());
        }
        
        return dto;
    }
}
