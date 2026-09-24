/**
 * Integration Module
 *
 * Enterprise Integration Framework for Gesher Distribution Platform.
 *
 * This module provides a generic integration architecture supporting
 * multiple providers across different categories:
 *
 * - Accounting: QuickBooks Online, Xero
 * - CRM: Pipedrive, HubSpot, Salesforce
 * - Project Management: Monday.com
 * - Shipping/Tracking: ShipStation, EasyPost
 *
 * Usage:
 * ```typescript
 * import { quickBooksProvider, pipedriveProvider } from '@/modules/integrations';
 *
 * // Initialize OAuth
 * const { state, authorizationUrl } = quickBooksProvider.initiateOAuth();
 *
 * // Handle callback
 * const connection = await quickBooksProvider.handleOAuthCallback(params);
 *
 * // Sync data
 * const results = await quickBooksProvider.sync(connectionId);
 * ```
 */

// ============================================
// CORE FRAMEWORK
// ============================================

export * from './core';

// ============================================
// PROVIDERS
// ============================================

export * from './providers';
