package com.mulaerp.inventory.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.inventory.dto.OpenStockTakeRequest;
import com.mulaerp.inventory.dto.RecordStockTakeCountRequest;
import com.mulaerp.inventory.dto.StockAdjustmentDTO;
import com.mulaerp.inventory.dto.StockTakeLineDTO;
import com.mulaerp.inventory.dto.StockTakeSessionDTO;
import com.mulaerp.inventory.entity.StockAdjustment;
import com.mulaerp.inventory.entity.StockTakeLine;
import com.mulaerp.inventory.entity.StockTakeSession;
import com.mulaerp.inventory.repository.StockTakeLineRepository;
import com.mulaerp.inventory.repository.StockTakeSessionRepository;
import com.mulaerp.warehouse.entity.Warehouse;
import com.mulaerp.warehouse.entity.WarehouseStock;
import com.mulaerp.warehouse.repository.WarehouseRepository;
import com.mulaerp.warehouse.repository.WarehouseStockRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Guided stock-take (physical count) workflow (V32 migration). Opening a session snapshots
 * {@code warehouse_stock} for one warehouse into {@code stock_take_lines}; staff record counts
 * against that snapshot; approval is the only step that mutates stock, and it does so entirely
 * through {@link InventoryService#createAdjustment} (one RECOUNT adjustment per non-zero-variance
 * line) so stock/warehouse_stock/the StockMovement ledger all move exactly as an ordinary manual
 * RECOUNT adjustment would - this service never writes stock directly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StockTakeService {

    // "cap at a sane page size" (spec) - a session snapshots at most this many warehouse_stock
    // rows at open time, sorted by id for a stable cut. A real warehouse's SKU count realistically
    // never approaches this; this is a hard backstop against an unbounded single-transaction
    // insert, not a limit anyone should ever hit in practice.
    private static final int MAX_LINES_PER_SESSION = 5000;

    private final StockTakeSessionRepository sessionRepository;
    private final StockTakeLineRepository lineRepository;
    private final WarehouseRepository warehouseRepository;
    private final WarehouseStockRepository warehouseStockRepository;
    private final InventoryService inventoryService;

    @Transactional
    public StockTakeSessionDTO openSession(OpenStockTakeRequest request) {
        Warehouse warehouse = warehouseRepository.findByIdAndDeletedFalse(request.getWarehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Warehouse not found with id: " + request.getWarehouseId()));

        StockTakeSession session = new StockTakeSession();
        session.setSessionNumber(generateSessionNumber());
        session.setWarehouseId(warehouse.getId());
        session.setStatus(StockTakeSession.StockTakeStatus.OPEN);
        session.setOpenedAt(LocalDateTime.now());
        session.setNotes(request.getNotes());
        session = sessionRepository.save(session);

        Pageable snapshotBound = PageRequest.of(0, MAX_LINES_PER_SESSION, Sort.by("id"));
        List<WarehouseStock> stockRows = warehouseStockRepository.findByWarehouseId(warehouse.getId(), snapshotBound);

        List<StockTakeLine> lines = new ArrayList<>(stockRows.size());
        for (WarehouseStock stockRow : stockRows) {
            StockTakeLine line = new StockTakeLine();
            line.setSession(session);
            line.setProduct(stockRow.getProduct());
            line.setExpectedQuantity(stockRow.getQuantity());
            lines.add(line);
        }
        lineRepository.saveAll(lines);

        log.info("Opened stock take {} for warehouse {} with {} line(s)",
                session.getSessionNumber(), warehouse.getCode(), lines.size());

        return toDto(session, warehouse);
    }

    @Transactional(readOnly = true)
    public Page<StockTakeSessionDTO> listSessions(String status, Pageable pageable) {
        StockTakeSession.StockTakeStatus statusFilter = parseStatus(status);
        Specification<StockTakeSession> spec = buildSessionSpecification(statusFilter);
        return sessionRepository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public StockTakeSessionDTO getSession(UUID id) {
        return toDto(getSessionEntity(id));
    }

    @Transactional(readOnly = true)
    public Page<StockTakeLineDTO> getLines(UUID sessionId, boolean onlyVariances, Pageable pageable) {
        // 404s if the session doesn't exist, same contract as every other nested-resource read.
        getSessionEntity(sessionId);
        Specification<StockTakeLine> spec = buildLineSpecification(sessionId, onlyVariances);
        return lineRepository.findAll(spec, pageable).map(StockTakeLineDTO::fromEntity);
    }

    @Transactional
    public StockTakeLineDTO recordCount(UUID sessionId, UUID lineId, RecordStockTakeCountRequest request) {
        StockTakeSession session = getSessionEntity(sessionId);
        if (session.getStatus() != StockTakeSession.StockTakeStatus.OPEN
                && session.getStatus() != StockTakeSession.StockTakeStatus.COUNTING) {
            throw new IllegalStateException(
                    "Cannot record counts on a stock take in status " + session.getStatus());
        }

        StockTakeLine line = lineRepository.findByIdAndSessionIdAndDeletedFalse(lineId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Stock take line not found: " + lineId));

        line.setCountedQuantity(request.getCountedQuantity());
        line.setVariance(request.getCountedQuantity() - line.getExpectedQuantity());
        line.setNote(request.getNote());
        line = lineRepository.save(line);

        if (session.getStatus() == StockTakeSession.StockTakeStatus.OPEN) {
            session.setStatus(StockTakeSession.StockTakeStatus.COUNTING);
            sessionRepository.save(session);
        }

        return StockTakeLineDTO.fromEntity(line);
    }

    @Transactional
    public StockTakeSessionDTO submit(UUID sessionId) {
        StockTakeSession session = getSessionEntity(sessionId);
        if (session.getStatus() != StockTakeSession.StockTakeStatus.OPEN
                && session.getStatus() != StockTakeSession.StockTakeStatus.COUNTING) {
            throw new IllegalStateException(
                    "Cannot submit a stock take in status " + session.getStatus());
        }

        long countedLines = lineRepository.countBySessionIdAndCountedQuantityIsNotNullAndDeletedFalse(sessionId);
        if (countedLines == 0) {
            throw new IllegalArgumentException("Cannot submit a stock take with no lines counted");
        }

        session.setStatus(StockTakeSession.StockTakeStatus.REVIEW);
        session = sessionRepository.save(session);
        return toDto(session);
    }

    /**
     * The only method in this service that moves stock, and it does so exclusively via
     * {@link InventoryService#createAdjustment} - one RECOUNT adjustment per line whose recorded
     * variance is non-zero, stamping approvedBy from the authenticated principal rather than
     * trusting client input (see {@link #currentUsername()}).
     */
    @Transactional
    public StockTakeSessionDTO approve(UUID sessionId) {
        StockTakeSession session = getSessionEntity(sessionId);
        if (session.getStatus() != StockTakeSession.StockTakeStatus.REVIEW) {
            throw new IllegalStateException(
                    "Cannot approve a stock take in status " + session.getStatus() + " - it must be in REVIEW");
        }

        String approver = currentUsername();
        List<StockTakeLine> variances = lineRepository.findBySessionIdAndVarianceNotAndDeletedFalse(sessionId, 0);
        for (StockTakeLine line : variances) {
            StockAdjustmentDTO adjustmentRequest = new StockAdjustmentDTO();
            adjustmentRequest.setProductId(line.getProduct().getId());
            adjustmentRequest.setWarehouseId(session.getWarehouseId());
            adjustmentRequest.setAdjustmentType(StockAdjustment.AdjustmentType.RECOUNT);
            adjustmentRequest.setQuantityAdjusted(line.getCountedQuantity());
            adjustmentRequest.setReason("Stock take " + session.getSessionNumber());
            adjustmentRequest.setNotes(line.getNote());
            adjustmentRequest.setAdjustmentDate(LocalDate.now());
            adjustmentRequest.setApprovedBy(approver);
            inventoryService.createAdjustment(adjustmentRequest);
        }

        session.setStatus(StockTakeSession.StockTakeStatus.APPROVED);
        session.setApprovedAt(LocalDateTime.now());
        session.setApprovedBy(approver);
        session = sessionRepository.save(session);

        log.info("Approved stock take {}: {} adjustment(s) created", session.getSessionNumber(), variances.size());

        return toDto(session);
    }

    @Transactional
    public StockTakeSessionDTO cancel(UUID sessionId) {
        StockTakeSession session = getSessionEntity(sessionId);
        if (session.getStatus() == StockTakeSession.StockTakeStatus.APPROVED) {
            throw new IllegalStateException("Cannot cancel an already-approved stock take");
        }
        if (session.getStatus() == StockTakeSession.StockTakeStatus.CANCELLED) {
            throw new IllegalStateException("Stock take is already cancelled");
        }

        session.setStatus(StockTakeSession.StockTakeStatus.CANCELLED);
        session = sessionRepository.save(session);
        return toDto(session);
    }

    private StockTakeSession getSessionEntity(UUID id) {
        return sessionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Stock take not found with id: " + id));
    }

    private StockTakeSessionDTO toDto(StockTakeSession session) {
        return toDto(session, null);
    }

    private StockTakeSessionDTO toDto(StockTakeSession session, Warehouse warehouseHint) {
        StockTakeSessionDTO dto = StockTakeSessionDTO.fromEntity(session);
        Warehouse warehouse = warehouseHint != null ? warehouseHint
                : warehouseRepository.findByIdAndDeletedFalse(session.getWarehouseId()).orElse(null);
        if (warehouse != null) {
            dto.setWarehouseCode(warehouse.getCode());
            dto.setWarehouseName(warehouse.getName());
        }
        dto.setTotalLines(lineRepository.countBySessionIdAndDeletedFalse(session.getId()));
        dto.setCountedLines(lineRepository.countBySessionIdAndCountedQuantityIsNotNullAndDeletedFalse(session.getId()));
        dto.setVarianceLines(lineRepository.countBySessionIdAndVarianceNotAndDeletedFalse(session.getId(), 0));
        return dto;
    }

    private StockTakeSession.StockTakeStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return StockTakeSession.StockTakeStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown stock take status: " + status);
        }
    }

    private Specification<StockTakeSession> buildSessionSpecification(StockTakeSession.StockTakeStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<StockTakeLine> buildLineSpecification(UUID sessionId, boolean onlyVariances) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            predicates.add(cb.equal(root.get("session").get("id"), sessionId));
            if (onlyVariances) {
                // Excludes NULL variances (uncounted lines) the same way the summary-count query
                // does - see StockTakeLineRepository#countBySessionIdAndVarianceNotAndDeletedFalse.
                predicates.add(cb.notEqual(root.get("variance"), 0));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // Second-precision timestamp alone isn't unique under concurrent callers - see
    // InventoryService#generateAdjustmentNumber for the same collision and the same fix (random
    // hex suffix, unique by construction). Format: ST-<yyyy>-<seq>-<4hex>, mirroring
    // PurchaseOrderService#generatePoNumber's year+sequence+hex shape.
    private String generateSessionNumber() {
        String prefix = "ST-" + LocalDate.now().getYear() + "-";
        long count = sessionRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return prefix + String.format("%06d", count) + "-" + suffix;
    }

    /** See CashUpService#currentUsername - same fallback contract. */
    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || authentication.getName() == null) {
            return "system";
        }
        return authentication.getName();
    }
}
