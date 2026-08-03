package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.StockMovementDTO;
import com.mulaerp.inventory.dto.StockMovementReconcileDTO;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.repository.StockMovementRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * WP7: single write path for the append-only stock movement ledger, called from every service
 * that mutates Product.stockQuantity / warehouse_stock (InventoryService, StockTransferService,
 * PosSaleService, PurchaseOrderService, SalesOrderService). Deliberately NOT non-blocking /
 * try-caught: recordMovement runs in the same transaction as the stock mutation it documents
 * (default REQUIRED propagation - joins the caller's existing @Transactional), so if the ledger
 * write fails the whole mutation rolls back with it. A ledger row and its stock change must never
 * be allowed to diverge.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StockMovementService {

    private final StockMovementRepository stockMovementRepository;
    private final ProductRepository productRepository;

    /**
     * Records one ledger row for a stock-affecting event. quantityAfter is always read off
     * {@code product.getStockQuantity()} at call time, so callers must invoke this only after
     * (or, for events that don't touch the product total at all - transfers, SO batch delivery -
     * at the point corresponding to) applying the mutation in memory.
     *
     * @param product       the product whose stock moved (or, for transfers/SO delivery, whose
     *                      total is unaffected but is still recorded for quantityAfter context)
     * @param warehouseId   nullable - the warehouse this movement applies to, when known
     * @param movementType  one of the fixed ledger movement types
     * @param quantityDelta signed change (positive = stock in, negative = stock out)
     * @param reference     the originating document number (adjustment/transfer/sale/order number)
     * @param notes         optional free-text context
     */
    @Transactional
    public StockMovement recordMovement(Product product, UUID warehouseId, StockMovement.MovementType movementType,
                                         int quantityDelta, String reference, String notes) {
        StockMovement movement = new StockMovement();
        movement.setProduct(product);
        movement.setWarehouseId(warehouseId);
        movement.setMovementType(movementType);
        movement.setQuantityDelta(quantityDelta);
        movement.setQuantityAfter(product.getStockQuantity());
        movement.setReference(reference);
        movement.setNotes(notes);

        StockMovement saved = stockMovementRepository.save(movement);
        log.info("Recorded stock movement: product={} type={} delta={} reference={}",
                product.getSku(), movementType, quantityDelta, reference);
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<StockMovementDTO> searchMovements(UUID productId, StockMovement.MovementType movementType,
                                                   LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        Specification<StockMovement> spec = buildSpecification(productId, movementType, startDate, endDate);
        return stockMovementRepository.findAll(spec, pageable).map(StockMovementDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    public StockMovementReconcileDTO reconcile(UUID productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));

        int currentStock = product.getStockQuantity();
        int ledgerSum = stockMovementRepository.sumQuantityDeltaByProductId(productId);
        long movementCount = stockMovementRepository.countByProduct_Id(productId);

        if (movementCount == 0) {
            return StockMovementReconcileDTO.builder()
                    .productId(productId)
                    .currentStock(currentStock)
                    .ledgerSum(0)
                    .baselineOffset(null)
                    .consistent(null)
                    .note("No ledger movements recorded yet for this product - nothing to reconcile against.")
                    .build();
        }

        Optional<StockMovement> first = stockMovementRepository.findFirstByProduct_IdOrderByCreatedAtAsc(productId);
        if (first.isEmpty() || first.get().getQuantityAfter() == null) {
            return StockMovementReconcileDTO.builder()
                    .productId(productId)
                    .currentStock(currentStock)
                    .ledgerSum(ledgerSum)
                    .baselineOffset(null)
                    .consistent(null)
                    .note("Baseline stock at ledger start is not derivable; ledgerSum and currentStock are reported as-is.")
                    .build();
        }

        StockMovement firstMovement = first.get();
        int baselineOffset = firstMovement.getQuantityAfter() - firstMovement.getQuantityDelta();
        boolean consistent = (baselineOffset + ledgerSum) == currentStock;

        return StockMovementReconcileDTO.builder()
                .productId(productId)
                .currentStock(currentStock)
                .ledgerSum(ledgerSum)
                .baselineOffset(baselineOffset)
                .consistent(consistent)
                .note("baselineOffset = stock level immediately before the first recorded movement " +
                        "(quantityAfter - quantityDelta of the earliest ledger row).")
                .build();
    }

    private Specification<StockMovement> buildSpecification(UUID productId, StockMovement.MovementType movementType,
                                                              LocalDateTime startDate, LocalDateTime endDate) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (productId != null) {
                predicates.add(cb.equal(root.get("product").get("id"), productId));
            }
            if (movementType != null) {
                predicates.add(cb.equal(root.get("movementType"), movementType));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
