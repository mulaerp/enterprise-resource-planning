package com.mulaerp.product.service;

import com.mulaerp.product.dto.*;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.entity.ProductCategory;
import com.mulaerp.product.repository.ProductCategoryRepository;
import com.mulaerp.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {
    
    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    
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
    
    @Transactional(readOnly = true)
    public ProductDto getProductById(UUID id) {
        Product product = productRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        return convertToDto(product);
    }
    
    @Transactional
    public ProductDto createProduct(CreateProductRequest request) {
        // Check if SKU already exists
        if (productRepository.findBySkuAndDeletedFalse(request.getSku()).isPresent()) {
            throw new RuntimeException("Product with SKU " + request.getSku() + " already exists");
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
        
        if (request.getCategoryId() != null) {
            ProductCategory category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new RuntimeException("Category not found"));
            product.setCategory(category);
        }
        
        Product savedProduct = productRepository.save(product);
        return convertToDto(savedProduct);
    }
    
    @Transactional
    public ProductDto updateProduct(UUID id, UpdateProductRequest request) {
        Product product = productRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setUnitPrice(request.getUnitPrice());
        product.setCostPrice(request.getCostPrice());
        product.setStockQuantity(request.getStockQuantity());
        product.setReorderLevel(request.getReorderLevel());
        product.setStatus(request.getStatus());
        
        if (request.getCategoryId() != null) {
            ProductCategory category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new RuntimeException("Category not found"));
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }
        
        Product updatedProduct = productRepository.save(product);
        return convertToDto(updatedProduct);
    }
    
    @Transactional
    public void deleteProduct(UUID id) {
        Product product = productRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        
        product.setDeleted(true);
        product.setDeletedAt(LocalDateTime.now());
        productRepository.save(product);
    }
    
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
