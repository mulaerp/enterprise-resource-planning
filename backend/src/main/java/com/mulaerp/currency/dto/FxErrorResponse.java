package com.mulaerp.currency.dto;

import java.time.LocalDateTime;

/**
 * Problem-JSON body for the one currency-module-specific error shape
 * (502 when every FX provider fails) - same field shape as
 * {@code GlobalExceptionHandler.ErrorResponse} minus {@code fieldErrors}, kept local to this
 * module rather than touching the shared handler.
 */
public record FxErrorResponse(
        LocalDateTime timestamp,
        int status,
        String error,
        String message,
        String path
) {
}
