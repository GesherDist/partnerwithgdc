/**
 * Cascade Delete Service
 *
 * Provides safe cascade deletion for Customers, Quotes, Sales Orders,
 * Purchase Orders, and Shipments using PostgreSQL functions with transaction safety
 */

import { db } from '@/shared/lib/supabase/database';

export type EntityType = 'customer' | 'quote' | 'sales_order' | 'purchase_order' | 'shipment';

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

export interface LookupResult {
  success: boolean;
  entityId?: string;
  error?: string;
}

/**
 * Lookup entity UUID by entity number (e.g., PO-2600064 -> UUID)
 */
export async function lookupEntityIdByNumber(
  entityType: EntityType,
  entityNumber: string
): Promise<LookupResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('lookup_entity_id_by_number', {
      p_entity_type: entityType,
      p_entity_number: entityNumber,
    });

    if (error) {
      console.error('Lookup entity ID error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      entityId: data as string,
    };
  } catch (error) {
    console.error('Lookup entity ID exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
 * Delete purchase order and all related data
 */
export async function deletePurchaseOrderCascade(
  purchaseOrderId: string,
  options: CascadeDeleteOptions = { deleteAuditLogs: true }
): Promise<CascadeDeleteResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('delete_purchase_order_cascade', {
      p_purchase_order_id: purchaseOrderId,
      p_delete_audit_logs: options.deleteAuditLogs ?? true,
    });

    if (error) {
      console.error('Delete purchase order cascade error:', error);
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
    console.error('Delete purchase order cascade exception:', error);
    return {
      success: false,
      deletedCounts: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete shipment and all related data
 */
export async function deleteShipmentCascade(
  shipmentId: string,
  options: CascadeDeleteOptions = { deleteAuditLogs: true }
): Promise<CascadeDeleteResult> {
  try {
    const supabase = db;

    const { data, error } = await supabase.rpc('delete_shipment_cascade', {
      p_shipment_id: shipmentId,
      p_delete_audit_logs: options.deleteAuditLogs ?? true,
    });

    if (error) {
      console.error('Delete shipment cascade error:', error);
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
    console.error('Delete shipment cascade exception:', error);
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
    case 'purchase_order':
      return deletePurchaseOrderCascade(entityId, options);
    case 'shipment':
      return deleteShipmentCascade(entityId, options);
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
  data: {
    name?: string;
    quote_number?: string;
    order_number?: string;
    po_number?: string;
    shipment_number?: string;
    customer_code?: string;
  }
): string {
  switch (entityType) {
    case 'customer':
      return data.name || data.customer_code || 'Unknown Customer';
    case 'quote':
      return data.quote_number || 'Unknown Quote';
    case 'sales_order':
      return data.order_number || 'Unknown Sales Order';
    case 'purchase_order':
      return data.po_number || 'Unknown Purchase Order';
    case 'shipment':
      return data.shipment_number || 'Unknown Shipment';
    default:
      return 'Unknown Entity';
  }
}

/**
 * Get entity number field name based on entity type
 */
export function getEntityNumberField(entityType: EntityType): string {
  switch (entityType) {
    case 'customer':
      return 'customer_code';
    case 'quote':
      return 'quote_number';
    case 'sales_order':
      return 'order_number';
    case 'purchase_order':
      return 'po_number';
    case 'shipment':
      return 'shipment_number';
    default:
      return 'id';
  }
}

/**
 * Verify entity exists before attempting delete
 */
export async function verifyEntityExists(
  entityType: EntityType,
  entityId: string
): Promise<{ exists: boolean; data?: Record<string, unknown>; error?: string }> {
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
      case 'purchase_order':
        tableName = 'purchase_orders';
        break;
      case 'shipment':
        tableName = 'shipments';
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

    return { exists: true, data: data as Record<string, unknown> };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify entity exists by number (e.g., PO-2600064)
 */
export async function verifyEntityExistsByNumber(
  entityType: EntityType,
  entityNumber: string
): Promise<{ exists: boolean; data?: Record<string, unknown>; entityId?: string; error?: string }> {
  try {
    const supabase = db;
    let tableName: string;
    let numberField: string;

    switch (entityType) {
      case 'customer':
        tableName = 'customers';
        numberField = 'customer_code';
        break;
      case 'quote':
        tableName = 'quotes';
        numberField = 'quote_number';
        break;
      case 'sales_order':
        tableName = 'sales_orders';
        numberField = 'order_number';
        break;
      case 'purchase_order':
        tableName = 'purchase_orders';
        numberField = 'po_number';
        break;
      case 'shipment':
        tableName = 'shipments';
        numberField = 'shipment_number';
        break;
      default:
        return { exists: false, error: 'Invalid entity type' };
    }

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(numberField, entityNumber)
      .is('deleted_at', null)
      .single();

    if (error) {
      return { exists: false, error: error.message };
    }

    return {
      exists: true,
      data: data as Record<string, unknown>,
      entityId: (data as Record<string, unknown>).id as string,
    };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
