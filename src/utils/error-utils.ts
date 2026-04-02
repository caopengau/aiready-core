/**
 * Common error handling utilities to reduce code duplication.
 * These patterns appear in 23+ files across the codebase.
 */

/**
 * Extract error message from unknown error type.
 * Replaces: error instanceof Error ? error.message : String(error)
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Extract error message with fallback for unknown errors.
 * Replaces: error instanceof Error ? error.message : 'Unknown error'
 */
export function toErrorMessage(
  error: unknown,
  fallback = 'Unknown error'
): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return fallback;
}

/**
 * Create a standardized API error response.
 * Replaces duplicated error response formatting patterns.
 */
export function createErrorResponse(
  message: string,
  status: number,
  details?: unknown
): { error: string; status: number; details?: unknown } {
  return {
    error: message,
    status,
    ...(details !== undefined && { details }),
  };
}

/**
 * Wrap an async function with standardized error handling.
 * Replaces duplicated try-catch patterns.
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const message = getErrorMessage(error);
    const contextPrefix = context ? `${context}: ` : '';
    return { success: false, error: `${contextPrefix}${message}` };
  }
}
