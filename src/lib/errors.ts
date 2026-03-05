import { HTTP_STATUS } from '@/helpers/constants';

/**
 * Base error class for application errors.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = HTTP_STATUS.SERVER_ERROR) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Validation error (400).
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * Authentication error (401).
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

/**
 * Authorization error (403).
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

/**
 * Not found error (404).
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

/**
 * Conflict error (409).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/**
 * Unauthorized error (401) — alias for AuthenticationError.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

/**
 * Forbidden error (403) — alias for AuthorizationError.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

/**
 * Token expired error (400).
 */
export class TokenExpiredError extends AppError {
  constructor(message = 'Token has expired') {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}
