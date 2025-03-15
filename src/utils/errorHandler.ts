export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export class AppError extends Error {
  severity: ErrorSeverity;
  context: Record<string, any>;
  originalError?: Error;

  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context: Record<string, any> = {},
    originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.severity = severity;
    this.context = context;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context = {}, originalError?: Error) {
    super(message, ErrorSeverity.ERROR, context, originalError);
    this.name = 'DatabaseError';
  }
}

// Other specialized error types...

export const handleError = (error: Error | AppError, context = {}): void => {
  // Log with appropriate severity and take action based on error type
  // Implement alert mechanism for critical errors
  // Format and log with context information
}