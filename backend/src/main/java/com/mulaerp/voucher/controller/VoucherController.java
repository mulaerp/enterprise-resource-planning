package com.mulaerp.voucher.controller;

import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.voucher.dto.CreateVoucherRequest;
import com.mulaerp.voucher.dto.VoucherDto;
import com.mulaerp.voucher.dto.VoucherValidateRequest;
import com.mulaerp.voucher.dto.VoucherValidateResponse;
import com.mulaerp.voucher.service.VoucherService;
import com.mulaerp.util.PageSizeCap;
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

@RestController
@RequestMapping("/api/v1/vouchers")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherService voucherService;

    @GetMapping
    public ResponseEntity<Page<VoucherDto>> getAllVouchers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("createdAt").descending());
        return ResponseEntity.ok(voucherService.getAllVouchers(pageable));
    }

    @PostMapping
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<VoucherDto> createVoucher(@Valid @RequestBody CreateVoucherRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(voucherService.createVoucher(request));
    }

    /** Query, not a mutation - always 200, valid:false + human message for any ineligible voucher. */
    @PostMapping("/validate")
    public ResponseEntity<VoucherValidateResponse> validateVoucher(@Valid @RequestBody VoucherValidateRequest request) {
        return ResponseEntity.ok(voucherService.validateVoucher(request.getCode(), request.getSubtotal()));
    }
}
