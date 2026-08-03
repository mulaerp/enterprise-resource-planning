package com.mulaerp.publicapi.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.publicapi.dto.PublicCategoryDto;
import com.mulaerp.publicapi.dto.PublicProductDto;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * PUBLIC-API: read-only, anonymous-safe views over the product catalogue for the B2C storefront
 * (SHOP). Reads through the existing ProductRepository - never exposes acquisitionCost,
 * costPrice, the raw stockQuantity number, or any internal id beyond sku (see #toPublicDto).
 */
@Service
@RequiredArgsConstructor
public class PublicCatalogService {

    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public Page<PublicProductDto> getCatalog(String search, String category, String condition, Pageable pageable) {
        Specification<Product> spec = buildSpecification(search, category, condition);
        return productRepository.findAll(spec, pageable).map(this::toPublicDto);
    }

    @Transactional(readOnly = true)
    public PublicProductDto getBySku(String sku) {
        Product product = productRepository.findBySkuAndDeletedFalse(sku)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + sku));
        return toPublicDto(product);
    }

    @Transactional(readOnly = true)
    public List<PublicCategoryDto> getCategories() {
        return productRepository.countActiveProductsByCategory().stream()
                .map(row -> new PublicCategoryDto((UUID) row[0], (String) row[1], (Long) row[2]))
                .collect(Collectors.toList());
    }

    private Specification<Product> buildSpecification(String search, String category, String condition) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));

            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("sku")), like)
                ));
            }

            // DATA INTEGRITY fix (post-overhaul audit): N+1 on category per row - #toPublicDto
            // below reads product.getCategory().getName() for every row, and category is a lazy
            // @ManyToOne, so without this a page of 10 products fired 1 (page query) + up to 10
            // (one per-row category lookup) queries. A single LEFT JOIN FETCH loads it in the
            // same query - guarded to the actual content query only, since Spring Data also runs
            // a separate COUNT query for Page<> that can't carry a fetch. Reused as the join for
            // the category-name filter below (rather than joining "category" a second time) - an
            // equality predicate on categoryJoin.name already excludes null-category rows, so
            // LEFT vs INNER makes no difference to the result set once that predicate is applied.
            boolean isCountQuery = Long.class.equals(query.getResultType()) || long.class.equals(query.getResultType());
            Join<Object, Object> categoryJoin = isCountQuery
                    ? null
                    : (Join<Object, Object>) root.fetch("category", JoinType.LEFT);

            if (category != null && !category.isBlank()) {
                Join<Object, Object> join = categoryJoin != null ? categoryJoin : root.join("category", JoinType.INNER);
                predicates.add(cb.equal(cb.lower(join.get("name")), category.trim().toLowerCase()));
            }
            if (condition != null && !condition.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("condition")), condition.trim().toUpperCase()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private PublicProductDto toPublicDto(Product product) {
        PublicProductDto dto = new PublicProductDto();
        dto.setId(product.getId());
        dto.setSku(product.getSku());
        dto.setName(product.getName());
        dto.setCategory(product.getCategory() != null ? product.getCategory().getName() : null);
        dto.setCondition(product.getCondition());
        dto.setTags(parseTags(product.getTags()));
        dto.setSellPrice(product.getUnitPrice());
        dto.setBuyPrice(product.getBuyPrice());
        dto.setStockStatus(stockStatus(product));
        dto.setHasBox(product.getHasBox());
        dto.setAccessories(product.getAccessories());
        dto.setImageUrl(product.getImageUrl());
        return dto;
    }

    private String stockStatus(Product product) {
        int stock = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
        int reorderLevel = product.getReorderLevel() != null ? product.getReorderLevel() : 0;
        if (stock == 0) {
            return "OUT_OF_STOCK";
        }
        if (stock <= reorderLevel) {
            return "LOW_STOCK";
        }
        return "IN_STOCK";
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
}
