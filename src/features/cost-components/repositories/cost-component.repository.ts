/**
 * Cost Components Repository
 *
 * Data access layer for Cost Components module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  CostComponent,
  CostComponentWithDetails,
  CostComponentListParams,
  CreateCostComponentDTO,
  UpdateCostComponentDTO,
  CostComponentType,
  LandedCostSummary,
  CostComponentSummary,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbCostComponent {
  id: string;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  component_type: CostComponentType;
  description: string | null;
  amount: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class CostComponentRepositoryImpl {
  /**
   * Find all cost components with optional filtering
   */
  async findMany(params: CostComponentListParams = {}): Promise<CostComponent[]> {
    const { purchaseOrderId, purchaseOrderItemId, componentType } = params;

    let query = db.from('cost_components').select('*');

    if (purchaseOrderId) {
      query = query.eq('purchase_order_id', purchaseOrderId);
    }

    if (purchaseOrderItemId) {
      query = query.eq('purchase_order_item_id', purchaseOrderItemId);
    }

    if (componentType) {
      query = query.eq('component_type', componentType);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch cost components: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToCostComponent(row as DbCostComponent));
  }

  /**
   * Find a single cost component by ID
   */
  async findById(id: string): Promise<CostComponentWithDetails | null> {
    const { data, error } = await db
      .from('cost_components')
      .select(
        `
        *,
        purchase_orders (
          id,
          po_number
        ),
        purchase_order_items (
          id,
          sku,
          description
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch cost component: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToCostComponentWithDetails(data);
  }

  /**
   * Create a new cost component
   */
  async create(data: CreateCostComponentDTO, userId?: string): Promise<CostComponent> {
    const { data: result, error } = await db
      .from('cost_components')
      .insert({
        purchase_order_id: data.purchaseOrderId || null,
        purchase_order_item_id: data.purchaseOrderItemId || null,
        component_type: data.componentType,
        description: data.description || null,
        amount: data.amount,
        currency_code: data.currencyCode || 'USD',
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create cost component: ${error.message}`);
    }

    return this.mapToCostComponent(result as DbCostComponent);
  }

  /**
   * Update an existing cost component
   */
  async update(id: string, data: UpdateCostComponentDTO, userId?: string): Promise<CostComponent> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.componentType !== undefined) {updateData.component_type = data.componentType;}
    if (data.description !== undefined) {updateData.description = data.description;}
    if (data.amount !== undefined) {updateData.amount = data.amount;}
    if (data.currencyCode !== undefined) {updateData.currency_code = data.currencyCode;}

    const { data: result, error } = await db
      .from('cost_components')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update cost component: ${error.message}`);
    }

    return this.mapToCostComponent(result as DbCostComponent);
  }

  /**
   * Delete a cost component
   */
  async delete(id: string): Promise<void> {
    const { error } = await db.from('cost_components').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete cost component: ${error.message}`);
    }
  }

  /**
   * Get landed cost summary for a PO
   */
  async getLandedCostSummary(purchaseOrderId: string): Promise<LandedCostSummary> {
    const components = await this.findMany({ purchaseOrderId });

    // Group by component type
    const groupedByType = components.reduce((acc, comp) => {
      if (!acc[comp.componentType]) {
        acc[comp.componentType] = {
          componentType: comp.componentType,
          totalAmount: 0,
          count: 0,
        };
      }
      acc[comp.componentType].totalAmount += comp.amount;
      acc[comp.componentType].count += 1;
      return acc;
    }, {} as Record<CostComponentType, CostComponentSummary>);

    const summaries = Object.values(groupedByType);
    const totalLandedCost = summaries.reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      purchaseOrderId,
      components: summaries,
      totalLandedCost,
      currencyCode: components[0]?.currencyCode || 'USD',
    };
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToCostComponent(data: DbCostComponent): CostComponent {
    return {
      id: data.id,
      purchaseOrderId: data.purchase_order_id,
      purchaseOrderItemId: data.purchase_order_item_id,
      componentType: data.component_type,
      description: data.description,
      amount: data.amount,
      currencyCode: data.currency_code,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToCostComponentWithDetails(data: {
    id: string;
    purchase_order_id: string | null;
    purchase_order_item_id: string | null;
    component_type: CostComponentType;
    description: string | null;
    amount: number;
    currency_code: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
    purchase_orders: { id: string; po_number: string } | null;
    purchase_order_items: { id: string; sku: string; description: string | null } | null;
  }): CostComponentWithDetails {
    return {
      id: data.id,
      purchaseOrderId: data.purchase_order_id,
      purchaseOrderItemId: data.purchase_order_item_id,
      componentType: data.component_type,
      description: data.description,
      amount: data.amount,
      currencyCode: data.currency_code,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      purchaseOrder: data.purchase_orders
        ? {
            id: data.purchase_orders.id,
            poNumber: data.purchase_orders.po_number,
          }
        : undefined,
      purchaseOrderItem: data.purchase_order_items
        ? {
            id: data.purchase_order_items.id,
            sku: data.purchase_order_items.sku,
            description: data.purchase_order_items.description,
          }
        : undefined,
    };
  }
}

export const costComponentRepository = new CostComponentRepositoryImpl();
export type CostComponentRepository = typeof costComponentRepository;
