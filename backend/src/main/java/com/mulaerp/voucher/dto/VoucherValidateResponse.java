package com.mulaerp.voucher.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Response for POST /vouchers/validate. This is a query, not a mutation - always returns
 * HTTP 200, with valid=false and a human-readable message for any ineligible voucher
 * (not found / expired / usage limit reached / min spend not met), rather than an HTTP error.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoucherValidateResponse {
    private boolean valid;
    private String code;
    private String type;
    private BigDecimal value;
    private BigDecimal discountAmount;
    private String message;
}
