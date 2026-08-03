package com.mulaerp.oversight.exception;

/**
 * Thrown by {@code MyDayService#getMyDay} when a CASHIER/ACCOUNTANT/INVENTORY caller supplies a
 * {@code username} naming someone other than themselves - those three roles may only ever see
 * their own day (see {@code MyDayService} class javadoc for the full scoping rule; MANAGER/ADMIN
 * are exempt and may pass any username).
 *
 * <p>Deliberately NOT {@link org.springframework.security.access.AccessDeniedException}: that
 * type is caught by {@code GlobalExceptionHandler}'s handler, which always returns the generic
 * "You do not have permission to access this resource" message (by design, for the security-
 * filter-chain-level denials it normally handles) - the whole point of this endpoint's contract is
 * a CLEAR, specific 403 message telling the cashier why, so this is its own type with its own
 * (controller-local) handler in {@code OversightMyDayController} instead.
 */
public class OwnDayOnlyException extends RuntimeException {
    public OwnDayOnlyException(String message) {
        super(message);
    }
}
