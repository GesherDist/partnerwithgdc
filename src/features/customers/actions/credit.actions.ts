/**
 * Credit Check Server Actions
 *
 * Actions for checking and managing customer credit.
 */

'use server';

import { creditCheckService } from '../services/credit-check.service';
import type { CreditCheckResult, CustomerCreditInfo } from '../services/credit-check.service';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// ACTIONS
// ============================================

/**
 * Get customer credit information
 */
export async function getCustomerCredit(
  customerId: string
): Promise<ActionResult<CustomerCreditInfo>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Anyone who can view customers or create orders can check credit
  if (!hasAnyPermission(user, ['customers.view_detail', 'quotes.create', 'sales_orders.create'])) {
    return { success: false, error: 'Permission denied' };
  }

  try {
    const credit = await creditCheckService.getCustomerCredit(customerId);
    if (!credit) {
      return { success: false, error: 'Customer not found' };
    }
    return { success: true, data: credit };
  } catch (error) {
    console.error('getCustomerCredit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get credit info',
    };
  }
}

/**
 * Check if customer has sufficient credit for an order
 */
export async function checkCustomerCredit(
  customerId: string,
  orderAmountCents: number
): Promise<ActionResult<CreditCheckResult>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Anyone creating quotes or orders can check credit
  if (!hasAnyPermission(user, ['quotes.create', 'sales_orders.create'])) {
    return { success: false, error: 'Permission denied' };
  }

  try {
    const result = await creditCheckService.checkCredit(customerId, orderAmountCents);
    return { success: true, data: result };
  } catch (error) {
    console.error('checkCustomerCredit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check credit',
    };
  }
}

/**
 * Add to customer's open balance (when invoice is created)
 */
export async function addToCustomerBalance(
  customerId: string,
  amountCents: number
): Promise<ActionResult<{ newBalance: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Only users who can create invoices can update balance
  if (!hasPermission(user, 'invoices.create')) {
    return { success: false, error: 'Permission denied' };
  }

  try {
    const result = await creditCheckService.addToBalance(customerId, amountCents, user.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: { newBalance: result.newBalance } };
  } catch (error) {
    console.error('addToCustomerBalance error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update balance',
    };
  }
}

/**
 * Subtract from customer's open balance (when payment is received)
 */
export async function subtractFromCustomerBalance(
  customerId: string,
  amountCents: number
): Promise<ActionResult<{ newBalance: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Only users who can process payments can update balance
  if (!hasAnyPermission(user, ['payments.create', 'invoices.edit'])) {
    return { success: false, error: 'Permission denied' };
  }

  try {
    const result = await creditCheckService.subtractFromBalance(customerId, amountCents, user.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: { newBalance: result.newBalance } };
  } catch (error) {
    console.error('subtractFromCustomerBalance error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update balance',
    };
  }
}

/**
 * Check if user has permission to override credit limit
 */
export async function canOverrideCredit(): Promise<ActionResult<boolean>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Finance and super_admin can override credit
  const canOverride = hasAnyPermission(user, ['credit.override', 'customers.edit']);
  return { success: true, data: canOverride };
}

/**
 * Log a credit override to approval_events
 */
export async function logCreditOverride(
  subjectType: 'quote' | 'sales_order',
  subjectId: string,
  note?: string
): Promise<ActionResult<void>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Only users with override permission can log overrides
  if (!hasAnyPermission(user, ['credit.override', 'customers.edit'])) {
    return { success: false, error: 'Permission denied' };
  }

  try {
    const result = await creditCheckService.logCreditOverride(
      subjectType,
      subjectId,
      user.id,
      note
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.error('logCreditOverride error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log credit override',
    };
  }
}
