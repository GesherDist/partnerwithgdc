/**
 * Cascade Delete Service
 *
 * Provides safe cascade deletion for Customers, Quotes, and Sales Orders
 * using PostgreSQL functions with transaction safety
 */

import { db } from '@/shared/lib/supabase/database';

export type EntityType = 'customer' | 'quote' | 'sales_order';

export interface CascadeDeleteOptions {
  deleteAuditLogs?: boolean;
}

export interface CascadeDeleteResult {
  success: boolean;
  deletedCounts: Record<string, number>;
  error?: string;
}

export interface PreviewResult {
  success: boolean;
  counts: Record<string, number>;
  error?: string;
}

/**
 * Preview what will be deleted without actually deleting
 */
export async function previewCascadeDelete(
  entityType: EntityType,
  entityId: string
): Promise<PreviewResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('preview_cascade_delete', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });

    if (error) {
      console.error('Preview cascade delete error:', error);
      return {
        success: false,
        counts: {},
        error: error.message,
      };
    }

    return {
      success: true,
      counts: data as Record<string, number>,
    };
  } catch (error) {
    console.error('Preview cascade delete exception:', error);
    return {
      success: false,
      counts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete customer and all related data
 */
export async function deleteCustomerCascade(
  customerId: string,
  options: CascadeDeleteOptions = { deleteAuditLogs: true }
): Promise<CascadeDeleteResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('delete_customer_cascade', {
      p_customer_id: customerId,
      p_delete_audit_logs: options.deleteAuditLogs ?? true,
    });

    if (error) {
      console.error('Delete customer cascade error:', error);
      return {
        success: false,
        deletedCounts: {},
        error: error.message,
      };
    }

    return {
      success: true,
      deletedCounts: data as Record<string, number>,
    };
  } catch (error) {
    console.error('Delete customer cascade exception:', error);
    return {
      success: false,
      deletedCounts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete quote and all related data (including created sales orders)
 */
export async function deleteQuoteCascade(
  quoteId: string,
  options: CascadeDeleteOptions = { deleteAuditLogs: true }
): Promise<CascadeDeleteResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('delete_quote_cascade', {
      p_quote_id: quoteId,
      p_delete_audit_logs: options.deleteAuditLogs ?? true,
    });

    if (error) {
      console.error('Delete quote cascade error:', error);
      return {
        success: false,
        deletedCounts: {},
        error: error.message,
      };
    }

    return {
      success: true,
      deletedCounts: data as Record<string, number>,
    };
  } catch (error) {
    console.error('Delete quote cascade exception:', error);
    return {
      success: false,
      deletedCounts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete sales order and all related data
 */
export async function deleteSalesOrderCascade(
  salesOrderId: string,
  options: CascadeDeleteOptions = { deleteAuditLogs: true }
): Promise<CascadeDeleteResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('delete_sales_order_cascade', {
      p_sales_order_id: salesOrderId,
      p_delete_audit_logs: options.deleteAuditLogs ?? true,
    });

    if (error) {
      console.error('Delete sales order cascade error:', error);
      return {
        success: false,
        deletedCounts: {},
        error: error.message,
      };
    }

    return {
      success: true,
      deletedCounts: data as Record<string, number>,
    };
  } catch (error) {
    console.error('Delete sales order cascade exception:', error);
    return {
      success: false,
      deletedCounts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generic cascade delete function (calls appropriate function based on entity type)
 */
export async function cascadeDelete(
  entityType: EntityType,
  entityId: string,
  options: CascadeDeleteOptions = { deleteAuditLogs: true }
): Promise<CascadeDeleteResult> {
  switch (entityType) {
    case 'customer':
      return deleteCustomerCascade(entityId, options);
    case 'quote':
      return deleteQuoteCascade(entityId, options);
    case 'sales_order':
      return deleteSalesOrderCascade(entityId, options);
    default:
      return {
        success: false,
        deletedCounts: {},
        error: `Invalid entity type: ${entityType}`,
      };
  }
}

/**
 * Get entity name for display purposes
 */
export function getEntityName(
  entityType: EntityType,
  data: { name?: string; quote_number?: string; order_number?: string }
): string {
  switch (entityType) {
    case 'customer':
      return data.name || 'Unknown Customer';
    case 'quote':
      return data.quote_number || 'Unknown Quote';
    case 'sales_order':
      return data.order_number || 'Unknown Sales Order';
    default:
      return 'Unknown Entity';
  }
}

/**
 * Verify entity exists before attempting delete
 */
export async function verifyEntityExists(
  entityType: EntityType,
  entityId: string
): Promise<{ exists: boolean; data?: any; error?: string }> {
  try {
    const supabase = db;
    let tableName: string;

    switch (entityType) {
      case 'customer':
        tableName = 'customers';
        break;
      case 'quote':
        tableName = 'quotes';
        break;
      case 'sales_order':
        tableName = 'sales_orders';
        break;
      default:
        return { exists: false, error: 'Invalid entity type' };
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', entityId)
      .single();

    if (error) {
      return { exists: false, error: error.message };
    }

    return { exists: true, data };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
