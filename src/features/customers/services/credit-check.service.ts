/**
 * Credit Check Service
 *
 * Handles credit validation for customers.
 * Used by Quotes and Sales Orders to verify customer credit before order placement.
 */

import { db } from '@/shared/lib/supabase/database';
import type { CreditStatus } from '../types';

// ============================================
// TYPES
// ============================================

export interface CreditCheckResult {
  /** Whether the credit check passed */
  passed: boolean;
  /** Customer's current credit status */
  creditStatus: CreditStatus;
  /** Customer's credit limit in cents */
  creditLimit: number;
  /** Customer's current open balance in cents */
  openBalance: number;
  /** Available credit (limit - open balance) in cents */
  availableCredit: number;
  /** The order amount being checked in cents */
  orderAmount: number;
  /** New balance if order is placed (open balance + order amount) */
  newBalance: number;
  /** Amount by which credit would be exceeded (if any) in cents */
  exceededBy: number;
  /** Warning/error message if check failed */
  message: string | null;
  /** Reason code for the failure */
  reason: 'approved' | 'status_not_approved' | 'limit_exceeded' | 'past_due' | null;
  /** Whether customer has overdue invoices */
  hasOverdueInvoices?: boolean;
  /** Number of overdue invoices */
  overdueInvoiceCount?: number;
}

export interface CustomerCreditInfo {
  id: string;
  name: string;
  creditStatus: CreditStatus;
  creditLimit: number;
  openBalance: number;
  creditTerms: string | null;
}

// ============================================
// SERVICE
// ============================================

class CreditCheckServiceImpl {
  /**
   * Check if customer has overdue invoices
   */
  async hasOverdueInvoices(customerId: string): Promise<{ hasOverdue: boolean; count: number }> {
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await db
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .lt('due_date', today)
      .not('status', 'eq', 'paid')
      .not('status', 'eq', 'cancelled')
      .is('deleted_at', null);

    if (error) {
      console.error('Error checking overdue invoices:', error);
      return { hasOverdue: false, count: 0 };
    }

    return { hasOverdue: (count ?? 0) > 0, count: count ?? 0 };
  }

  /**
   * Log credit override to approval_events
   */
  async logCreditOverride(
    subjectType: 'quote' | 'sales_order',
    subjectId: string,
    userId: string,
    note?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await db.from('approval_events').insert({
      type: 'credit_release',
      subject_type: subjectType,
      subject_id: subjectId,
      status: 'approved',
      decided_by: userId,
      decided_at: new Date().toISOString(),
      note: note || 'Credit limit override applied',
    });

    if (error) {
      console.error('Error logging credit override:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Get customer credit information
   */
  async getCustomerCredit(customerId: string): Promise<CustomerCreditInfo | null> {
    const { data, error } = await db
      .from('customers')
      .select('id, name, credit_status, credit_limit, open_balance, credit_terms')
      .eq('id', customerId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      creditStatus: data.credit_status as CreditStatus,
      creditLimit: data.credit_limit,
      openBalance: data.open_balance,
      creditTerms: data.credit_terms,
    };
  }

  /**
   * Check if a customer has sufficient credit for an order
   *
   * @param customerId - Customer ID to check
   * @param orderAmountCents - Order total in cents
   * @returns Credit check result with pass/fail and details
   */
  async checkCredit(customerId: string, orderAmountCents: number): Promise<CreditCheckResult> {
    const customer = await this.getCustomerCredit(customerId);

    if (!customer) {
      return {
        passed: false,
        creditStatus: 'pending',
        creditLimit: 0,
        openBalance: 0,
        availableCredit: 0,
        orderAmount: orderAmountCents,
        newBalance: orderAmountCents,
        exceededBy: orderAmountCents,
        message: 'Customer not found',
        reason: null,
      };
    }

    const availableCredit = customer.creditLimit - customer.openBalance;
    const newBalance = customer.openBalance + orderAmountCents;
    const exceededBy = Math.max(0, newBalance - customer.creditLimit);

    // Check for overdue invoices
    const overdueCheck = await this.hasOverdueInvoices(customerId);

    // Check 1: Credit status must be "approved"
    if (customer.creditStatus !== 'approved') {
      return {
        passed: false,
        creditStatus: customer.creditStatus,
        creditLimit: customer.creditLimit,
        openBalance: customer.openBalance,
        availableCredit,
        orderAmount: orderAmountCents,
        newBalance,
        exceededBy,
        message: this.getStatusMessage(customer.creditStatus, customer.name),
        reason: 'status_not_approved',
        hasOverdueInvoices: overdueCheck.hasOverdue,
        overdueInvoiceCount: overdueCheck.count,
      };
    }

    // Check 2: Customer must not have overdue invoices
    if (overdueCheck.hasOverdue) {
      return {
        passed: false,
        creditStatus: customer.creditStatus,
        creditLimit: customer.creditLimit,
        openBalance: customer.openBalance,
        availableCredit,
        orderAmount: orderAmountCents,
        newBalance,
        exceededBy,
        message: `Customer has ${overdueCheck.count} overdue invoice(s). Payment required before new orders.`,
        reason: 'past_due',
        hasOverdueInvoices: true,
        overdueInvoiceCount: overdueCheck.count,
      };
    }

    // Check 3: Order amount must not exceed available credit
    if (orderAmountCents > availableCredit) {
      return {
        passed: false,
        creditStatus: customer.creditStatus,
        creditLimit: customer.creditLimit,
        openBalance: customer.openBalance,
        availableCredit,
        orderAmount: orderAmountCents,
        newBalance,
        exceededBy,
        message: `Credit limit exceeded by ${this.formatCurrency(exceededBy)}. Available credit: ${this.formatCurrency(availableCredit)}`,
        reason: 'limit_exceeded',
        hasOverdueInvoices: false,
        overdueInvoiceCount: 0,
      };
    }

    // All checks passed
    return {
      passed: true,
      creditStatus: customer.creditStatus,
      creditLimit: customer.creditLimit,
      openBalance: customer.openBalance,
      availableCredit,
      orderAmount: orderAmountCents,
      newBalance,
      exceededBy: 0,
      message: null,
      reason: 'approved',
      hasOverdueInvoices: false,
      overdueInvoiceCount: 0,
    };
  }

  /**
   * Update customer's open balance
   *
   * @param customerId - Customer ID
   * @param amountCents - Amount to add (positive) or subtract (negative)
   * @param userId - User making the change (for audit)
   */
  async updateOpenBalance(
    customerId: string,
    amountCents: number,
    userId?: string
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    // Get current balance
    const customer = await this.getCustomerCredit(customerId);
    if (!customer) {
      return { success: false, newBalance: 0, error: 'Customer not found' };
    }

    const newBalance = customer.openBalance + amountCents;

    // Don't allow negative balance
    if (newBalance < 0) {
      return {
        success: false,
        newBalance: customer.openBalance,
        error: 'Balance cannot be negative'
      };
    }

    const { error } = await db
      .from('customers')
      .update({
        open_balance: newBalance,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);

    if (error) {
      return { success: false, newBalance: customer.openBalance, error: error.message };
    }

    return { success: true, newBalance };
  }

  /**
   * Add to open balance (when invoice is created)
   */
  async addToBalance(customerId: string, amountCents: number, userId?: string) {
    return this.updateOpenBalance(customerId, amountCents, userId);
  }

  /**
   * Subtract from open balance (when payment is received)
   */
  async subtractFromBalance(customerId: string, amountCents: number, userId?: string) {
    return this.updateOpenBalance(customerId, -amountCents, userId);
  }

  // ============================================
  // HELPERS
  // ============================================

  private getStatusMessage(status: CreditStatus, customerName: string): string {
    switch (status) {
      case 'pending':
        return `${customerName}'s credit is pending approval. Cannot place orders until credit is approved.`;
      case 'hold':
        return `${customerName}'s credit is on hold. Please contact finance to resolve.`;
      case 'suspended':
        return `${customerName}'s credit is suspended. Please contact finance to resolve.`;
      case 'blocked':
        return `${customerName}'s credit is blocked. Cannot place orders.`;
      case 'rejected':
        return `${customerName}'s credit application was rejected. Cannot place orders on credit.`;
      default:
        return `${customerName}'s credit status (${status}) does not allow orders.`;
    }
  }

  private formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }
}

export const creditCheckService = new CreditCheckServiceImpl();
export type CreditCheckService = typeof creditCheckService;
