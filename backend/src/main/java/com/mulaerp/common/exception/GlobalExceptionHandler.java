package com.mulaerp.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * WP11: every response out of this handler shares one JSON shape -
 * {timestamp, status, error, message, path, fieldErrors?} - so frontend callers that read
 * {@code err.response?.data?.message} keep working unchanged, while callers that want per-field
 * detail (bean validation failures) can additionally read {@code fieldErrors: [{field, message}]}.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, "Invalid email or password", request);
    }

    // Added for WP1a (multi-warehouse): several service methods across the codebase already
    // throw ResourceNotFoundException / IllegalArgumentException / IllegalStateException for
    // "not found" and business-rule violations (see StockTransferService, BatchTrackingService,
    // PurchaseOrderService, etc.), but with no dedicated handler they previously fell through to
    // the generic RuntimeException handler below and were reported as 500s. These three handlers
    // map them to the correct 4xx status instead - a correctness fix that applies to every module
    // using these exception types, not just the new warehouse code.
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex, HttpServletRequest request) {
        return build(HttpStatus.CONFLICT, ex.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<FieldErrorDetail> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new FieldErrorDetail(fe.getField(), fe.getDefaultMessage()))
                .toList();
        ErrorResponse error = new ErrorResponse(
                LocalDateTime.now(),
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                "Validation failed",
                request.getRequestURI(),
                fieldErrors
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String requiredType = ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "the expected type";
        String message = "Parameter '" + ex.getName() + "' should be of type " + requiredType;
        return build(HttpStatus.BAD_REQUEST, message, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Malformed request body", request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleMissingPart(MissingServletRequestPartException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    // WP12: optimistic locking. Every BaseEntity now carries @Version. Spring's JPA exception
    // translation wraps both a mid-transaction repository.save() conflict and a commit-time flush
    // conflict as ObjectOptimisticLockingFailureException (a DataAccessException) - see
    // EntityManagerFactoryUtils#convertJpaAccessExceptionIfPossible, which explicitly maps
    // jakarta.persistence.OptimisticLockException to it - so catching the Spring type covers both
    // paths. The jakarta type is also handled directly as a defensive fallback for any call site
    // that touches EntityManager/OptimisticLockException without going through a Spring repository.
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLocking(ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        return build(HttpStatus.CONFLICT, "This record was modified by someone else. Refresh and try again.", request);
    }

    @ExceptionHandler(jakarta.persistence.OptimisticLockException.class)
    public ResponseEntity<ErrorResponse> handleJpaOptimisticLocking(jakarta.persistence.OptimisticLockException ex, HttpServletRequest request) {
        return build(HttpStatus.CONFLICT, "This record was modified by someone else. Refresh and try again.", request);
    }

    // FIX: an unmapped/typo'd path (e.g. GET /api/v1/accounting/trial-balance instead of the real
    // /api/v1/accounting/reports/trial-balance) was previously falling all the way through to
    // handleGenericException below - Spring 6.1+'s DispatcherServlet raises NoResourceFoundException
    // ("No static resource ...") for any request that matches neither a controller mapping nor a
    // real static asset, and NoResourceFoundException is a RuntimeException, so it was being logged
    // as an "Unhandled Exception" and reported as a confusing 500. It is a client-side "you asked
    // for something that doesn't exist" case, not a server fault - map it to 404 with the same
    // {timestamp,status,error,message,path,fieldErrors} shape as everything else, and DO NOT log a
    // stack trace for it (unlike a genuine unexpected exception, this is expected/routine traffic).
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(NoResourceFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND,
                "No endpoint found for " + request.getMethod() + " " + request.getRequestURI(), request);
    }

    // Defensive companion to the handler above: NoHandlerFoundException is the older/alternate
    // "no mapping matched" signal (only raised when
    // spring.mvc.throw-exception-if-no-handler-found=true, which this app does not currently set -
    // NoResourceFoundException above is the one actually observed), kept here in case that config
    // ever changes or another code path throws it directly, so an unmapped path 404s either way
    // instead of silently falling back to a 500.
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoHandlerFound(NoHandlerFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND,
                "No endpoint found for " + ex.getHttpMethod() + " " + ex.getRequestURL(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, "You do not have permission to access this resource", request);
    }

    // CRITICAL FIX 3 (belt and braces): every non-blocking side-effect hook (auto-journal/email/
    // warranty-issue) now runs in its own REQUIRES_NEW transaction via NonBlockingHookExecutor, so
    // a failure inside one should never propagate here. This handler is a defensive backstop in
    // case a hook is ever added elsewhere without going through that pattern - it turns what would
    // otherwise be a confusing generic 500 into an explicit, clearly-labelled one.
    @ExceptionHandler(UnexpectedRollbackException.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedRollback(UnexpectedRollbackException ex, HttpServletRequest request) {
        log.error("UnexpectedRollbackException - a non-blocking side-effect hook marked the transaction " +
                "rollback-only instead of failing independently: {}", ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "The operation could not be completed because an internal step failed. Please try again; " +
                        "if this persists, contact support.", request);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException ex, HttpServletRequest request) {
        log.error("Unhandled RuntimeException: {}", ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        log.error("Unhandled Exception: {}", ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request);
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String message, HttpServletRequest request) {
        ErrorResponse error = new ErrorResponse(
                LocalDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                request.getRequestURI(),
                null
        );
        return ResponseEntity.status(status).body(error);
    }

    /**
     * Standard error body shape for the whole API. {@code fieldErrors} is only populated for
     * bean-validation failures ({@link MethodArgumentNotValidException}); every other handler
     * leaves it {@code null} so it's omitted from the response... actually Jackson still emits
     * {@code "fieldErrors":null} by default, which is intentionally kept (a present-but-null key
     * is easier for frontend code to feature-detect than a key that may or may not exist).
     */
    public record ErrorResponse(
            LocalDateTime timestamp,
            int status,
            String error,
            String message,
            String path,
            List<FieldErrorDetail> fieldErrors) {

        public ErrorResponse(int status, String error, String message, String path) {
            this(LocalDateTime.now(), status, error, message, path, null);
        }
    }

    public record FieldErrorDetail(String field, String message) {}
}
