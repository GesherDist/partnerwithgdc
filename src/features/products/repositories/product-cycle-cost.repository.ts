/**
 * Product Cycle Cost Repository
 *
 * Purchase cost per product per order cycle (product_cycle_costs, migration 169).
 */

import { db } from '@/shared/lib/supabase/database';
import { buildCycleCostLookup, type CycleCostLookup, type CycleCostRow } from '../lib/cycle-cost';

export interface ProductCycleCost extends CycleCostRow {
  id: string;
  updatedAt: string;
}

interface DbProductCycleCost {
  id: string;
  product_id: string;
  order_series: string;
  cost: number;
  updated_at: string;
}

function mapRow(row: DbProductCycleCost): ProductCycleCost {
  return {
    id: row.id,
    productId: row.product_id,
    orderSeries: row.order_series,
    cost: Number(row.cost),
    updatedAt: row.updated_at,
  };
}

export const productCycleCostRepository = {
  async listByProduct(productId: string): Promise<ProductCycleCost[]> {
    const { data, error } = await db
      .from('product_cycle_costs')
      .select('id, product_id, order_series, cost, updated_at')
      .eq('product_id', productId)
      .order('order_series');
    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as DbProductCycleCost[]).map(mapRow);
  },

  /** Cost (cents) per product id for one order cycle */
  async mapBySeries(orderSeries: string): Promise<Record<string, number>> {
    const { data, error } = await db
      .from('product_cycle_costs')
      .select('product_id, cost')
      .eq('order_series', orderSeries);
    if (error) {
      throw new Error(error.message);
    }
    return Object.fromEntries(
      ((data ?? []) as Array<{ product_id: string; cost: number }>).map((r) => [String(r.product_id), Number(r.cost)])
    );
  },

  async findOne(productId: string, orderSeries: string): Promise<ProductCycleCost | null> {
    const { data, error } = await db
      .from('product_cycle_costs')
      .select('id, product_id, order_series, cost, updated_at')
      .eq('product_id', productId)
      .eq('order_series', orderSeries)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapRow(data as DbProductCycleCost) : null;
  },

  async create(productId: string, orderSeries: string, cost: number, userId?: string): Promise<ProductCycleCost> {
    const { data, error } = await db
      .from('product_cycle_costs')
      .insert({
        product_id: productId,
        order_series: orderSeries,
        cost,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select('id, product_id, order_series, cost, updated_at')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapRow(data as DbProductCycleCost);
  },

  async updateCost(id: string, cost: number, userId?: string): Promise<ProductCycleCost> {
    const { data, error } = await db
      .from('product_cycle_costs')
      .update({ cost, updated_at: new Date().toISOString(), updated_by: userId ?? null })
      .eq('id', id)
      .select('id, product_id, order_series, cost, updated_at')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapRow(data as DbProductCycleCost);
  },

  async remove(productId: string, orderSeries: string): Promise<void> {
    const { error } = await db
      .from('product_cycle_costs')
      .delete()
      .eq('product_id', productId)
      .eq('order_series', orderSeries);
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Unit cost (cents) per product id for an order of the given cycle: the
   * cycle's cost, else the product's base cost. Products that cannot be read
   * are left out.
   */
  async unitCostsFor(productIds: string[], orderSeries?: string | null): Promise<Map<string, number>> {
    const costs = new Map<string, number>();
    const ids = [...new Set(productIds.filter(Boolean))];
    if (ids.length === 0) {
      return costs;
    }

    const { data: products, error } = await db.from('products').select('id, base_cost').in('id', ids);
    if (error) {
      console.error('[unitCostsFor] Error fetching product costs:', error.message);
      return costs;
    }
    for (const p of (products ?? []) as Array<{ id: string; base_cost: number | null }>) {
      costs.set(String(p.id), Number(p.base_cost ?? 0));
    }

    if (orderSeries) {
      const { data: cycleRows, error: cycleError } = await db
        .from('product_cycle_costs')
        .select('product_id, cost')
        .eq('order_series', orderSeries)
        .in('product_id', ids);
      if (cycleError) {
        console.error('[unitCostsFor] Cycle costs unavailable, using base cost:', cycleError.message);
      } else {
        for (const r of (cycleRows ?? []) as Array<{ product_id: string; cost: number }>) {
          costs.set(String(r.product_id), Number(r.cost));
        }
      }
    }

    return costs;
  },

  /**
   * Lookup for COGS. Falls back to base cost only when the table cannot be
   * read (e.g. migration 169 not applied yet), so dashboards keep working.
   */
  async loadLookup(): Promise<CycleCostLookup> {
    const { data, error } = await db.from('product_cycle_costs').select('product_id, order_series, cost');
    if (error) {
      console.error('Cycle costs unavailable, using product base cost:', error.message);
      return buildCycleCostLookup([]);
    }
    return buildCycleCostLookup(
      ((data ?? []) as Array<{ product_id: string; order_series: string; cost: number }>).map((r) => ({
        productId: String(r.product_id),
        orderSeries: String(r.order_series),
        cost: Number(r.cost),
      }))
    );
  },
};
