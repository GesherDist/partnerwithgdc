/**
 * Application Constants
 *
 * Global constants used throughout the application.
 */

// ============================================
// APP INFO
// ============================================

export const APP_NAME = 'Gesher Distribution';
export const APP_DESCRIPTION = 'Enterprise Operations Platform for Agricultural Tire Distribution';
export const APP_VERSION = '0.1.0';

// ============================================
// PAGINATION
// ============================================

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;

// ============================================
// DATE FORMATS
// ============================================

export const DATE_FORMAT = 'MMM dd, yyyy';
export const DATE_TIME_FORMAT = 'MMM dd, yyyy HH:mm';
export const TIME_FORMAT = 'HH:mm';
export const DATE_INPUT_FORMAT = 'yyyy-MM-dd';

// ============================================
// VALIDATION
// ============================================

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const PHONE_REGEX = /^\+?[\d\s\-()]{10,20}$/;
export const EMAIL_MAX_LENGTH = 255;

// ============================================
// FILE UPLOAD
// ============================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// ============================================
// API
// ============================================

export const API_TIMEOUT = 30000; // 30 seconds
export const API_RETRY_COUNT = 3;
export const API_RETRY_DELAY = 1000; // 1 second

// ============================================
// CACHE
// ============================================

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

// ============================================
// DEBOUNCE
// ============================================

export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  INPUT: 150,
  RESIZE: 100,
} as const;
