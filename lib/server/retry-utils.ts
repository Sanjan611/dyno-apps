/**
 * Retry Utilities
 *
 * Shared retry logic with exponential backoff for handling transient errors
 */

import { BamlValidationError, BamlClientFinishReasonError } from "@boundaryml/baml";
import { LOG_PREFIXES } from "@/lib/constants";

/**
 * Default retryable error types for BAML operations
 */
const DEFAULT_RETRYABLE_ERRORS = [BamlValidationError, BamlClientFinishReasonError];

/**
 * Executes an async function with retry logic and exponential backoff
 *
 * @template T The return type of the async function
 * @param fn The async function to execute with retry
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param retryableErrors Array of error constructors that should trigger a retry (default: BAML validation errors)
 * @param logPrefix Optional prefix for logging retry attempts
 * @returns The result of the successful function execution
 * @throws The last error if all retries are exhausted or a non-retryable error is encountered
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  retryableErrors: any[] = DEFAULT_RETRYABLE_ERRORS,
  logPrefix?: string
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Success - log retry attempt if this wasn't the first attempt
      if (attempt > 0 && logPrefix) {
        console.log(`${logPrefix} succeeded on retry attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      // Check if this error type should trigger a retry
      const shouldRetry = retryableErrors.some((ErrorType) => error instanceof ErrorType);

      if (shouldRetry) {
        lastError = error;

        if (attempt < maxRetries) {
          // Calculate exponential backoff delay: 1s, 2s, 4s, etc.
          const delayMs = Math.pow(2, attempt) * 1000;

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } else {
        // Non-retryable error - throw immediately
        throw error;
      }
    }
  }

  // If we get here, all retries were exhausted
  if (lastError) {
    throw lastError;
  }

  // This should never happen, but TypeScript needs it
  throw new Error("Unexpected error in retry logic");
}
