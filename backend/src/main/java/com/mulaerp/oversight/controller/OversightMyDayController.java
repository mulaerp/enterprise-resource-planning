package com.mulaerp.oversight.controller;

import com.mulaerp.common.exception.GlobalExceptionHandler;
import com.mulaerp.oversight.dto.MyDayResponseDto;
import com.mulaerp.oversight.exception.OwnDayOnlyException;
import com.mulaerp.oversight.service.MyDayService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * "My Day" - a cashier's own shift report. Deliberately its OWN controller, separate from
 * {@link OversightController} (whole-class {@code RoleRules#MANAGER_UP}) - this is the one
 * oversight-adjacent screen every staff role gets, so it carries no controller/method-level
 * {@code @PreAuthorize} at all (same "no restriction = any authenticated user" convention as
 * PoS sale creation/repair job updates, see the {@code backend-dev} skill). Every scoping rule
 * (a CASHIER may only ever see their own day, MANAGER/ADMIN may view anyone's) is enforced inside
 * {@link MyDayService#getMyDay}, never trusted to the client.
 */
@RestController
@RequiredArgsConstructor
public class OversightMyDayController {

    private final MyDayService myDayService;

    @GetMapping("/api/v1/oversight/my-day")
    public ResponseEntity<MyDayResponseDto> myDay(
            @RequestParam LocalDate date,
            @RequestParam(required = false) String username
    ) {
        return ResponseEntity.ok(myDayService.getMyDay(date, username));
    }

    /**
     * Controller-local handler for {@link OwnDayOnlyException} - see that class's javadoc for why
     * this bypasses {@code GlobalExceptionHandler}'s generic {@code AccessDeniedException} handler
     * (Spring MVC resolves a controller-local {@code @ExceptionHandler} before falling back to a
     * {@code @ControllerAdvice}, so this never touches the shared handler). Same response shape as
     * every other error in the API ({@link GlobalExceptionHandler.ErrorResponse}).
     */
    @ExceptionHandler(OwnDayOnlyException.class)
    public ResponseEntity<GlobalExceptionHandler.ErrorResponse> handleOwnDayOnly(OwnDayOnlyException ex, HttpServletRequest request) {
        GlobalExceptionHandler.ErrorResponse body = new GlobalExceptionHandler.ErrorResponse(
                LocalDateTime.now(), HttpStatus.FORBIDDEN.value(), HttpStatus.FORBIDDEN.getReasonPhrase(),
                ex.getMessage(), request.getRequestURI(), null);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }
}
