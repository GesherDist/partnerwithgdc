/**
 * Cost per order cycle
 *
 * Tire purchase costs vary by order cycle (Ankur, Oct 23, 2026: GDC 2 is $20
 * less per tire than GDC 0 / GDC 1). A product's cost on an order is the cost
 * entered for the order's cycle (product_cycle_costs), else its base cost.
 *
 * A sales order line's cost (sales_order_items.unit_cost) is saved by its
 * first fulfillment allocation; margin and COGS use the saved cost first.
 */

export interface CycleCostRow {
  productId: string;
  orderSeries: string;
  /** cents */
  cost: number;
}

/** Returns the unit cost (cents) for a product on an order of the given cycle */
export type CycleCostLookup = (productId: string | null | undefined, orderSeries: string | null | undefined, baseCost: number) => number;

export function buildCycleCostLookup(rows: CycleCostRow[]): CycleCostLookup {
  const costs = new Map(rows.map((r) => [`${r.productId}|${r.orderSeries}`, r.cost]));
  return (productId, orderSeries, baseCost) => {
    if (productId && orderSeries) {
      const cost = costs.get(`${productId}|${orderSeries}`);
      if (cost !== undefined) {
        return cost;
      }
    }
    return baseCost;
  };
}
