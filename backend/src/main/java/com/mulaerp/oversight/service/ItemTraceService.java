package com.mulaerp.oversight.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.customer.entity.Customer;
import com.mulaerp.customer.repository.CustomerRepository;
import com.mulaerp.inventory.entity.ProductSerial;
import com.mulaerp.inventory.entity.StockMovement;
import com.mulaerp.inventory.repository.ProductSerialRepository;
import com.mulaerp.inventory.repository.StockMovementRepository;
import com.mulaerp.member.entity.Member;
import com.mulaerp.member.repository.MemberRepository;
import com.mulaerp.oversight.dto.ItemTraceEventDto;
import com.mulaerp.oversight.dto.ItemTraceResponseDto;
import com.mulaerp.oversight.repository.OversightPosSaleLineRepository;
import com.mulaerp.oversight.repository.OversightPosSaleRepository;
import com.mulaerp.oversight.repository.OversightPosTradeInLineRepository;
import com.mulaerp.oversight.repository.OversightPosTradeInRepository;
import com.mulaerp.pos.entity.PosSale;
import com.mulaerp.pos.entity.PosSaleLine;
import com.mulaerp.pos.entity.PosTradeIn;
import com.mulaerp.pos.entity.PosTradeInLine;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.repair.entity.RepairJob;
import com.mulaerp.repair.entity.RepairPart;
import com.mulaerp.repair.repository.RepairJobRepository;
import com.mulaerp.repair.repository.RepairPartRepository;
import com.mulaerp.warranty.entity.Warranty;
import com.mulaerp.warranty.repository.WarrantyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Builds the full chronological trace for a single item (product) from every table that already
 * records what happened to it - no new ledger, just a read-time assembly of:
 * <ul>
 *   <li>{@link StockMovement} rows (trade-in receipt, PO receipt, opening stock, warehouse
 *       transfers, PoS sale decrement, repair part consumption, adjustments, recounts) -
 *       queried via the existing {@code StockMovementRepository}'s {@code JpaSpecificationExecutor}
 *       rather than adding a new finder method to that repository;</li>
 *   <li>{@link Warranty} rows issued/claimed/voided against the product;</li>
 *   <li>enrichment lookups (sale/trade-in/repair-job document + actor + amount) via the oversight
 *       module's own read-only secondary repositories (see {@code OversightPosSaleRepository} and
 *       siblings) plus the existing, unmodified {@code RepairJobRepository}/{@code RepairPartRepository}.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ItemTraceService {

    private static final int MAX_EVENTS = 500;

    private final ProductRepository productRepository;
    private final ProductSerialRepository productSerialRepository;
    private final StockMovementRepository stockMovementRepository;
    private final WarrantyRepository warrantyRepository;
    private final RepairJobRepository repairJobRepository;
    private final RepairPartRepository repairPartRepository;
    private final MemberRepository memberRepository;
    private final CustomerRepository customerRepository;
    private final OversightPosSaleRepository oversightPosSaleRepository;
    private final OversightPosSaleLineRepository oversightPosSaleLineRepository;
    private final OversightPosTradeInRepository oversightPosTradeInRepository;
    private final OversightPosTradeInLineRepository oversightPosTradeInLineRepository;

    @Transactional(readOnly = true)
    public ItemTraceResponseDto traceItem(String sku, String serial, UUID productId) {
        Product product = resolveProduct(sku, serial, productId);

        List<ItemTraceEventDto> events = new ArrayList<>();
        events.addAll(buildStockMovementEvents(product));
        events.addAll(buildWarrantyEvents(product));

        events.sort(Comparator.comparing(ItemTraceEventDto::timestamp));

        boolean truncated = events.size() > MAX_EVENTS;
        String note = null;
        if (truncated) {
            int omitted = events.size() - MAX_EVENTS;
            events = new ArrayList<>(events.subList(omitted, events.size()));
            note = "Timeline capped at " + MAX_EVENTS + " events - " + omitted
                    + " earlier event(s) were omitted (showing the most recent " + MAX_EVENTS + ").";
        }

        return new ItemTraceResponseDto(product.getId(), product.getSku(), product.getName(), events, truncated, note);
    }

    private Product resolveProduct(String sku, String serial, UUID productId) {
        if (productId != null) {
            return productRepository.findByIdAndDeletedFalse(productId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found: " + productId));
        }
        if (sku != null && !sku.isBlank()) {
            return productRepository.findBySkuAndDeletedFalse(sku)
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found for sku: " + sku));
        }
        if (serial != null && !serial.isBlank()) {
            ProductSerial productSerial = productSerialRepository.findBySerialNumber(serial)
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found for serial: " + serial));
            return productRepository.findByIdAndDeletedFalse(productSerial.getProduct().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found for serial: " + serial));
        }
        throw new IllegalArgumentException("One of sku, serial, or productId query parameters is required");
    }

    private List<ItemTraceEventDto> buildStockMovementEvents(Product product) {
        List<StockMovement> movements = stockMovementRepository.findAll(
                (root, query, cb) -> cb.equal(root.get("product").get("id"), product.getId()),
                Sort.by("createdAt").ascending());

        List<ItemTraceEventDto> events = new ArrayList<>();
        for (StockMovement movement : movements) {
            events.add(toEvent(movement, product));
        }
        return events;
    }

    private ItemTraceEventDto toEvent(StockMovement movement, Product product) {
        String reference = movement.getReference();
        switch (movement.getMovementType()) {
            case POS_SALE -> {
                return posSaleEvent(movement, product, reference);
            }
            case TRADE_IN_RECEIPT -> {
                return tradeInEvent(movement, product, reference);
            }
            case REPAIR_PART_CONSUMED -> {
                return repairPartEvent(movement, product, reference);
            }
            case TRANSFER_OUT -> {
                return genericEvent(movement, "WAREHOUSE_TRANSFER_OUT",
                        movement.getNotes() != null ? movement.getNotes() : "Transferred out of warehouse");
            }
            case TRANSFER_IN -> {
                return genericEvent(movement, "WAREHOUSE_TRANSFER_IN",
                        movement.getNotes() != null ? movement.getNotes() : "Transferred into warehouse");
            }
            case PO_RECEIPT -> {
                return genericEvent(movement, "PO_RECEIPT",
                        movement.getNotes() != null ? movement.getNotes() : "Purchase order receipt");
            }
            case RECOUNT -> {
                return genericEvent(movement, "RECOUNT",
                        movement.getNotes() != null ? movement.getNotes() : "Stock recount");
            }
            case ADJUSTMENT -> {
                boolean isOpeningStock = "Opening stock".equals(movement.getNotes());
                return genericEvent(movement, isOpeningStock ? "OPENING_STOCK" : "STOCK_ADJUSTMENT",
                        movement.getNotes() != null ? movement.getNotes() : "Stock adjustment");
            }
            default -> {
                return genericEvent(movement, movement.getMovementType().name(), movement.getNotes());
            }
        }
    }

    private ItemTraceEventDto genericEvent(StockMovement movement, String type, String detail) {
        return new ItemTraceEventDto(movement.getCreatedAt(), type, movement.getReference(),
                movement.getCreatedBy(), movement.getQuantityDelta(), null, detail);
    }

    private ItemTraceEventDto posSaleEvent(StockMovement movement, Product product, String saleNumber) {
        Optional<PosSale> saleOpt = saleNumber != null
                ? oversightPosSaleRepository.findBySaleNumberAndDeletedFalse(saleNumber) : Optional.empty();

        String actor = movement.getCreatedBy();
        BigDecimal amount = null;
        StringBuilder detail = new StringBuilder("Sold via ").append(saleNumber != null ? saleNumber : "unknown sale");

        if (saleOpt.isPresent()) {
            PosSale sale = saleOpt.get();
            actor = sale.getCreatedBy() != null ? sale.getCreatedBy() : actor;

            Optional<PosSaleLine> line = oversightPosSaleLineRepository.findByProductIdOrderByCreatedAtAsc(product.getId())
                    .stream()
                    .filter(l -> l.getSale() != null && l.getSale().getId().equals(sale.getId()))
                    .findFirst();
            if (line.isPresent()) {
                amount = line.get().getLineTotal();
            }

            if (sale.getMemberId() != null) {
                Optional<Member> member = memberRepository.findByIdAndDeletedFalse(sale.getMemberId());
                detail.append(" to member ").append(member.map(Member::getName).orElse(sale.getMemberId().toString()));
            } else {
                detail.append(" (walk-in customer)");
            }
        }

        return new ItemTraceEventDto(movement.getCreatedAt(), "POS_SALE", saleNumber, actor,
                movement.getQuantityDelta(), amount, detail.toString());
    }

    private ItemTraceEventDto tradeInEvent(StockMovement movement, Product product, String tradeInNumber) {
        Optional<PosTradeIn> tradeInOpt = tradeInNumber != null
                ? oversightPosTradeInRepository.findByTradeInNumberAndDeletedFalse(tradeInNumber) : Optional.empty();

        String actor = movement.getCreatedBy();
        BigDecimal amount = null;
        StringBuilder detail = new StringBuilder("Trade-in receipt");

        if (tradeInOpt.isPresent()) {
            PosTradeIn tradeIn = tradeInOpt.get();
            actor = tradeIn.getCreatedBy() != null ? tradeIn.getCreatedBy() : actor;
            detail.append(" (").append(tradeIn.getPayoutType()).append(")");

            Optional<PosTradeInLine> line = oversightPosTradeInLineRepository.findByProductIdOrderByCreatedAtAsc(product.getId())
                    .stream()
                    .filter(l -> l.getTradeIn() != null && l.getTradeIn().getId().equals(tradeIn.getId()))
                    .findFirst();
            if (line.isPresent()) {
                amount = line.get().getPayoutAmount();
            }

            if (tradeIn.getMemberId() != null) {
                Optional<Member> member = memberRepository.findByIdAndDeletedFalse(tradeIn.getMemberId());
                detail.append(" from member ").append(member.map(Member::getName).orElse(tradeIn.getMemberId().toString()));
            }
        }

        return new ItemTraceEventDto(movement.getCreatedAt(), "TRADE_IN_RECEIPT", tradeInNumber, actor,
                movement.getQuantityDelta(), amount, detail.toString());
    }

    private ItemTraceEventDto repairPartEvent(StockMovement movement, Product product, String jobNumber) {
        boolean reversed = movement.getQuantityDelta() != null && movement.getQuantityDelta() > 0;
        Optional<RepairJob> jobOpt = jobNumber != null
                ? repairJobRepository.findByJobNumberAndDeletedFalse(jobNumber) : Optional.empty();

        BigDecimal amount = null;
        StringBuilder detail = new StringBuilder(reversed ? "Repair part consumption reversed for " : "Consumed for repair ")
                .append(jobNumber != null ? jobNumber : "unknown job");

        if (jobOpt.isPresent()) {
            RepairJob job = jobOpt.get();
            Optional<RepairPart> part = repairPartRepository.findByRepairJobIdOrderByCreatedAtAsc(job.getId())
                    .stream()
                    .filter(p -> p.getProductId().equals(product.getId()))
                    .findFirst();
            int qty = Math.abs(movement.getQuantityDelta() != null ? movement.getQuantityDelta() : 0);
            if (part.isPresent()) {
                amount = part.get().getUnitCost().multiply(BigDecimal.valueOf(qty));
            }

            if (job.getCustomerId() != null) {
                Optional<Customer> customer = customerRepository.findByIdAndDeletedFalse(job.getCustomerId());
                detail.append(" for ").append(customer.map(Customer::getName).orElse(job.getCustomerId().toString()));
            } else if (job.getWalkInName() != null) {
                detail.append(" for ").append(job.getWalkInName());
            }
        }

        return new ItemTraceEventDto(movement.getCreatedAt(), "REPAIR_PART_CONSUMED", jobNumber,
                movement.getCreatedBy(), movement.getQuantityDelta(), amount, detail.toString());
    }

    private List<ItemTraceEventDto> buildWarrantyEvents(Product product) {
        List<Warranty> warranties = warrantyRepository.findAll(
                (root, query, cb) -> cb.and(
                        cb.equal(root.get("productId"), product.getId()),
                        cb.equal(root.get("deleted"), false)));

        List<ItemTraceEventDto> events = new ArrayList<>();
        for (Warranty warranty : warranties) {
            events.add(new ItemTraceEventDto(warranty.getCreatedAt(), "WARRANTY_ISSUED", warranty.getWarrantyNumber(),
                    warranty.getCreatedBy(), null, null,
                    "Warranty issued (" + warranty.getMonths() + " months), covers to " + warranty.getExpiryDate()));

            if (warranty.getStatus() == Warranty.WarrantyStatus.CLAIMED) {
                events.add(new ItemTraceEventDto(warranty.getUpdatedAt(), "WARRANTY_CLAIMED", warranty.getWarrantyNumber(),
                        warranty.getUpdatedBy(), null, null, "Warranty claimed"));
            } else if (warranty.getStatus() == Warranty.WarrantyStatus.VOID) {
                events.add(new ItemTraceEventDto(warranty.getUpdatedAt(), "WARRANTY_VOID", warranty.getWarrantyNumber(),
                        warranty.getUpdatedBy(), null, null, "Warranty voided"));
            }
        }
        return events;
    }
}
