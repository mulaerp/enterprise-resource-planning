package com.mulaerp.pos.controller;

import com.mulaerp.pos.dto.CreatePosTradeInRequest;
import com.mulaerp.pos.dto.PosTradeInDto;
import com.mulaerp.pos.dto.TradeInSuggestionDto;
import com.mulaerp.pos.service.PosTradeInService;
import com.mulaerp.pos.service.TradeInSuggestionService;
import com.mulaerp.util.PageSizeCap;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Trade-in purchases - no controller-level role restriction, same as PosSaleController: trade-ins
 * are cashier work (any authenticated user), per the approved design decision. Includes
 * GET /suggest (V38, TradeInSuggestionService) - a static path segment, so it never collides with
 * the {id} path variable below regardless of declaration order (Spring's handler mapping ranks a
 * literal segment as more specific than a template variable at request time).
 */
@RestController
@RequestMapping("/api/v1/pos/trade-ins")
@RequiredArgsConstructor
public class PosTradeInController {

    private final PosTradeInService posTradeInService;
    private final TradeInSuggestionService tradeInSuggestionService;

    @GetMapping
    public ResponseEntity<Page<PosTradeInDto>> getAllTradeIns(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size));
        return ResponseEntity.ok(posTradeInService.getAllTradeIns(pageable));
    }

    /** V38: deterministic (no LLM/model) product-linking suggestions for the register's Trade-In
     * panel - see TradeInSuggestionService for matching + pricing. */
    @GetMapping("/suggest")
    public ResponseEntity<List<TradeInSuggestionDto>> suggest(
            @RequestParam String q,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) Boolean hasBox
    ) {
        return ResponseEntity.ok(tradeInSuggestionService.suggest(q, condition, hasBox));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PosTradeInDto> getTradeInById(@PathVariable UUID id) {
        return ResponseEntity.ok(posTradeInService.getTradeInById(id));
    }

    /** IDEMPOTENT: a replayed clientTradeInId returns the existing trade-in with HTTP 200. */
    @PostMapping
    public ResponseEntity<PosTradeInDto> createTradeIn(@Valid @RequestBody CreatePosTradeInRequest request) {
        PosTradeInService.TradeInResult result = posTradeInService.createTradeIn(request);
        HttpStatus status = result.created() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(result.dto());
    }
}
