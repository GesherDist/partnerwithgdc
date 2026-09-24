/**
 * Rate Limiter for Pipedrive API
 *
 * Pipedrive has rate limits:
 * - 100 requests per 10 seconds for most endpoints
 * - Some endpoints have lower limits
 *
 * This utility ensures we don't exceed these limits.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface QueuedRequest {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

export class RateLimiter {
  private requests: number[] = [];
  private queue: QueuedRequest[] = [];
  private processing = false;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 80, windowMs: 10000 }) {
    // Default to 80 requests per 10 seconds (leaving buffer for safety)
    this.config = config;
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Process the queue of pending requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Clean up old requests outside the window
      const now = Date.now();
      this.requests = this.requests.filter(
        (time) => now - time < this.config.windowMs
      );

      // Check if we can make a request
      if (this.requests.length >= this.config.maxRequests) {
        // Wait until the oldest request is outside the window
        const oldestRequest = this.requests[0];
        if (oldestRequest !== undefined) {
          const waitTime = this.config.windowMs - (now - oldestRequest) + 100; // +100ms buffer
          await this.sleep(waitTime);
        }
        continue;
      }

      // Execute the next request
      const item = this.queue.shift();
      if (!item) break;

      this.requests.push(Date.now());

      try {
        const result = await item.execute();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get current request count in window
   */
  getRequestCount(): number {
    const now = Date.now();
    this.requests = this.requests.filter(
      (time) => now - time < this.config.windowMs
    );
    return this.requests.length;
  }

  /**
   * Check if rate limited
   */
  isRateLimited(): boolean {
    return this.getRequestCount() >= this.config.maxRequests;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
    this.queue = [];
    this.processing = false;
  }
}

// Singleton instance for Pipedrive API
export const pipedriveRateLimiter = new RateLimiter({
  maxRequests: 80, // 80 requests per 10 seconds (leaving 20 for buffer)
  windowMs: 10000,
});

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);

      // Add jitter (random variation) to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const finalDelay = delay + jitter;

      console.log(
        `[Pipedrive] Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(finalDelay)}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}

/**
 * Check if error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.includes('rate limit');
  }
  return false;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Retry on rate limits, network errors, and 5xx errors
    const message = error.message.toLowerCase();
    return (
      isRateLimitError(error) ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }
  return false;
}
