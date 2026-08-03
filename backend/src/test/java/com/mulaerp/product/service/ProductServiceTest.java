package com.mulaerp.product.service;

import com.mulaerp.product.dto.CreateProductRequest;
import com.mulaerp.product.dto.ProductDto;
import com.mulaerp.product.dto.UpdateProductRequest;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.entity.ProductCategory;
import com.mulaerp.product.repository.ProductCategoryRepository;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.inventory.service.StockMovementService;
import com.mulaerp.warehouse.service.WarehouseService;
import com.mulaerp.warehouse.service.WarehouseStockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit Tests for ProductService
 * Phase 5.3: Testing
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductCategoryRepository categoryRepository;

    @Mock
    private WarehouseService warehouseService;

    @Mock
    private WarehouseStockService warehouseStockService;

    // PROBLEM 2 fix: ProductService#createProduct now records an opening-stock StockMovement -
    // needed so @InjectMocks has something other than null to wire in, avoiding an NPE in
    // testCreateProduct_Success (stockQuantity=20 triggers the movement-recording branch).
    @Mock
    private StockMovementService stockMovementService;

    @InjectMocks
    private ProductService productService;

    private Product testProduct;
    private ProductCategory testCategory;
    private UUID productId;
    private UUID categoryId;

    @BeforeEach
    void setUp() {
        productId = UUID.randomUUID();
        categoryId = UUID.randomUUID();

        testCategory = new ProductCategory();
        testCategory.setId(categoryId);
        testCategory.setName("Test Category");

        testProduct = new Product();
        testProduct.setId(productId);
        testProduct.setSku("TEST-001");
        testProduct.setName("Test Product");
        testProduct.setDescription("Test Description");
        testProduct.setUnitPrice(new BigDecimal("100.00"));
        testProduct.setCostPrice(new BigDecimal("50.00"));
        testProduct.setStockQuantity(10);
        testProduct.setReorderLevel(5);
        testProduct.setStatus("ACTIVE");
        testProduct.setCategory(testCategory);
        testProduct.setDeleted(false);
    }

    @Test
    void testGetProductById_Success() {
        // Arrange
        when(productRepository.findByIdAndDeletedFalse(productId)).thenReturn(Optional.of(testProduct));

        // Act
        ProductDto result = productService.getProductById(productId);

        // Assert
        assertNotNull(result);
        assertEquals(productId, result.getId());
        assertEquals("TEST-001", result.getSku());
        assertEquals("Test Product", result.getName());
        verify(productRepository, times(1)).findByIdAndDeletedFalse(productId);
    }

    @Test
    void testGetProductById_NotFound() {
        // Arrange
        when(productRepository.findByIdAndDeletedFalse(productId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(RuntimeException.class, () -> productService.getProductById(productId));
        verify(productRepository, times(1)).findByIdAndDeletedFalse(productId);
    }

    @Test
    void testCreateProduct_Success() {
        // Arrange
        CreateProductRequest request = new CreateProductRequest();
        request.setSku("NEW-001");
        request.setName("New Product");
        request.setDescription("New Description");
        request.setUnitPrice(new BigDecimal("200.00"));
        request.setCostPrice(new BigDecimal("100.00"));
        request.setStockQuantity(20);
        request.setReorderLevel(10);
        request.setStatus("ACTIVE");
        request.setCategoryId(categoryId);

        when(productRepository.findBySkuAndDeletedFalse("NEW-001")).thenReturn(Optional.empty());
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(testCategory));
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);
        when(warehouseService.getDefaultWarehouseId()).thenReturn(UUID.randomUUID());

        // Act
        ProductDto result = productService.createProduct(request);

        // Assert
        assertNotNull(result);
        verify(productRepository, times(1)).findBySkuAndDeletedFalse("NEW-001");
        verify(categoryRepository, times(1)).findById(categoryId);
        verify(productRepository, times(1)).save(any(Product.class));
    }

    @Test
    void testCreateProduct_DuplicateSku() {
        // Arrange
        CreateProductRequest request = new CreateProductRequest();
        request.setSku("TEST-001");
        request.setName("Duplicate Product");

        when(productRepository.findBySkuAndDeletedFalse("TEST-001")).thenReturn(Optional.of(testProduct));

        // Act & Assert
        assertThrows(RuntimeException.class, () -> productService.createProduct(request));
        verify(productRepository, times(1)).findBySkuAndDeletedFalse("TEST-001");
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void testUpdateProduct_Success() {
        // Arrange
        UpdateProductRequest request = new UpdateProductRequest();
        request.setName("Updated Product");
        request.setDescription("Updated Description");
        request.setUnitPrice(new BigDecimal("150.00"));
        request.setCostPrice(new BigDecimal("75.00"));
        request.setStockQuantity(15);
        request.setReorderLevel(7);
        request.setStatus("ACTIVE");
        request.setCategoryId(categoryId);

        when(productRepository.findByIdAndDeletedFalse(productId)).thenReturn(Optional.of(testProduct));
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(testCategory));
        // WP12: ProductService#updateProduct calls saveAndFlush (not save) so the version bump is
        // visible before convertToDto reads it - see that method's Javadoc. This stub was still
        // targeting save(), so saveAndFlush() fell through to Mockito's default null return,
        // producing a NullPointerException in convertToDto - fixed by stubbing the method the
        // production code actually calls.
        when(productRepository.saveAndFlush(any(Product.class))).thenReturn(testProduct);

        // Act
        ProductDto result = productService.updateProduct(productId, request);

        // Assert
        assertNotNull(result);
        verify(productRepository, times(1)).findByIdAndDeletedFalse(productId);
        verify(categoryRepository, times(1)).findById(categoryId);
        verify(productRepository, times(1)).saveAndFlush(any(Product.class));
    }

    @Test
    void testDeleteProduct_Success() {
        // Arrange
        when(productRepository.findByIdAndDeletedFalse(productId)).thenReturn(Optional.of(testProduct));
        when(productRepository.save(any(Product.class))).thenReturn(testProduct);

        // Act
        productService.deleteProduct(productId);

        // Assert
        verify(productRepository, times(1)).findByIdAndDeletedFalse(productId);
        verify(productRepository, times(1)).save(any(Product.class));
        assertTrue(testProduct.getDeleted());
        assertNotNull(testProduct.getDeletedAt());
    }
}
