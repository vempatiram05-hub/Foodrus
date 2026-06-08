import { logger } from "./logger";

export interface RetryOptions {
  /** Maximum number of attempts (including the first call). Default: 3 */
  maxAttempts?: number;
  /** Base delay in milliseconds for the first retry. Default: 200 */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds. Default: 5000 */
  maxDelayMs?: number;
  /** Label shown in log messages to identify the operation. */
  operationName?: string;
}

/**
 * Retries an async operation with exponential backoff + jitter.
 *
 * Usage:
 *   const result = await withRetry(() => helcimService.charge(payload), {
 *     maxAttempts: 3,
 *     operationName: "helcim.charge",
 *   });
 *
 * Throws the last error if all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 200,
    maxDelayMs = 5_000,
    operationName = "operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) break;

      // Exponential backoff with full jitter to avoid thundering herd
      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * exponential;
      const delay = Math.min(exponential + jitter, maxDelayMs);

      logger.warn(`${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delay)}ms`, {
        attempt,
        maxAttempts,
        error: err instanceof Error ? err.message : String(err),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error(`${operationName} failed after ${maxAttempts} attempts`, {
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  throw lastError;
}
