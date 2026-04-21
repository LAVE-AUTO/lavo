import { HTTP_STATUS } from '@/helpers/constants';

// Typed application error hierarchy mapped to HTTP status codes.

// --- Base ---

/**
 * Base class for all application errors.
 *
 * Sets `isOperational = true` so error-handling middleware can distinguish
 * expected domain errors from unexpected crashes.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  /** Optional API-level code forwarded in the response body by route handlers. */
  code?: string;

  constructor(message: string, statusCode: number = HTTP_STATUS.SERVER_ERROR, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// --- 4xx Client Errors ---

/** Validation error (400). */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}

/** Authentication / credentials error (401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

/**
 * Forbidden error (403).
 * Accepts an optional API-level code for structured error responses.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied', code?: string) {
    super(message, HTTP_STATUS.FORBIDDEN, code);
  }
}

/** Not found error (404). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

/** Conflict error (409). */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Token expired or already used (400). */
export class TokenExpiredError extends AppError {
  constructor(message = 'Token has expired') {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}

// --- 5xx Server Errors ---

/**
 * Not implemented error (501).
 * Used for endpoints or service methods that are stubs pending implementation.
 */
export class NotImplementedError extends AppError {
  constructor(message = 'Not implemented') {
    super(message, HTTP_STATUS.NOT_IMPLEMENTED);
  }
}

// --- Domain Errors ---
// Fine-grained conflict/validation errors for specific business rules.

/** User already has an active reservation or queue entry at this station (409). */
export class ActiveReservationExistsError extends AppError {
  constructor(message = 'You already have an active reservation or queue entry at this station') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Time slot has no remaining capacity (409). */
export class SlotFullError extends AppError {
  constructor(message = 'This time slot is full') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Reservation has already been rated (409). */
export class AlreadyRatedError extends AppError {
  constructor(message = 'This reservation has already been rated') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Rating submission window (7 days) has expired (409). */
export class RatingWindowExpiredError extends AppError {
  constructor(message = 'The 7-day rating window has expired') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Reservation is not in completed status (409). */
export class ReservationNotCompletedError extends AppError {
  constructor(message = 'The reservation is not completed') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** A dispute already exists for this reservation (409). */
export class DisputeAlreadyExistsError extends AppError {
  constructor(message = 'A dispute already exists for this reservation') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Dispute is already closed (refunded, resolved, or rejected) (409). */
export class DisputeAlreadyClosedError extends AppError {
  constructor(message = 'This dispute is already closed') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/** Refund not eligible because a Stripe transfer to the station already occurred (400). */
export class RefundNotEligibleError extends AppError {
  constructor(message = 'Refund is not eligible: a transfer to the station has already been made') {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}
