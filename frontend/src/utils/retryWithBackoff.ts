/**
 * Pure async retry utility with exponential backoff and jitter.
 * No Vue coupling — safe to use anywhere (composables, services, tests).
 */

export interface RetryConfig {
  /** Maximum number of retry attempts (not counting the initial try). */
  maxRetries: number;
  /** Base delay in milliseconds before first retry. */
  baseDelayMs: number;
  /** Random jitter ceiling in milliseconds added to each delay. */
  jitterMs: number;
  /** Return true for errors that should trigger a retry. */
  retryOn: (error: unknown) => boolean;
  /** Called before each retry with the attempt index (1-based) and delay used. */
  onRetry?: (attempt: number, delayMs: number) => void;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  jitterMs: 200,
  retryOn: () => false,
};

/**
 * Execute `fn`, retrying on errors that satisfy `config.retryOn`.
 * Delay formula: `baseDelayMs * 2^(attempt-1) + random(0, jitterMs)`.
 * Re-throws the last error after all retries are exhausted.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, jitterMs, retryOn, onRetry } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !retryOn(error)) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * jitterMs;
      onRetry?.(attempt + 1, delay);
      await sleep(delay);
    }
  }

  // Unreachable — loop always throws or returns, but TypeScript needs this.
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
