/**
 * Pipedrive API Errors
 *
 * Typed error carrying the HTTP status so callers can decide
 * whether to retry (429/5xx), refresh (401) or treat as not found (404).
 */

import { PIPEDRIVE_ERRORS } from './constants';

export class PipedriveApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  /** Delay suggested by Pipedrive before retrying (from Retry-After), if any */
  readonly retryAfterMs?: number;

  constructor(status: number, endpoint: string, retryAfterMs?: number) {
    super(`${PIPEDRIVE_ERRORS.API_ERROR} (HTTP ${status} on ${endpoint})`);
    this.name = 'PipedriveApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isPipedriveApiError(error: unknown): error is PipedriveApiError {
  return error instanceof PipedriveApiError;
}

/**
 * True when the resource does not exist (or was deleted) in Pipedrive
 */
export function isPipedriveNotFound(error: unknown): boolean {
  return isPipedriveApiError(error) && (error.status === 404 || error.status === 410);
}

/**
 * Parse the Retry-After header (seconds or HTTP date) into milliseconds
 */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}
