package com.mulaerp.payment.controller;

import com.mulaerp.payment.dto.CreatePaymentRequest;
import com.mulaerp.payment.dto.PaymentDTO;
import com.mulaerp.payment.entity.Payment;
import com.mulaerp.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Payment management endpoints")
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping
    @Operation(summary = "Get all payments")
    public ResponseEntity<Page<PaymentDTO>> getAllPayments(Pageable pageable) {
        return ResponseEntity.ok(paymentService.getAllPayments(pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get payment by ID")
    public ResponseEntity<PaymentDTO> getPaymentById(@PathVariable UUID id) {
        return ResponseEntity.ok(paymentService.getPaymentById(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search payments")
    public ResponseEntity<Page<PaymentDTO>> searchPayments(
            @RequestParam String query,
            Pageable pageable) {
        return ResponseEntity.ok(paymentService.searchPayments(query, pageable));
    }

    @PostMapping
    @Operation(summary = "Create payment")
    public ResponseEntity<PaymentDTO> createPayment(
            @Valid @RequestBody CreatePaymentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(paymentService.createPayment(request));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update payment status")
    public ResponseEntity<PaymentDTO> updateStatus(
            @PathVariable UUID id,
            @RequestParam Payment.PaymentStatus status) {
        return ResponseEntity.ok(paymentService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete payment")
    public ResponseEntity<Void> deletePayment(@PathVariable UUID id) {
        paymentService.deletePayment(id);
        return ResponseEntity.noContent().build();
    }
}
