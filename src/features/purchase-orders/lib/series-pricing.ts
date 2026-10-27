/**
 * PO line prices by order series
 *
 * Tire lines are priced at the product's cost for the PO's order series
 * (Products > Cost by Order Cycle), else the product's base cost.
 */

export interface SeriesPricedProduct {
  id: string;
  baseCost: number;
  itemType: 'inventory' | 'non_inventory' | 'service';
}

export interface SeriesPricedLine {
  productId: string;
  quantityOrdered: number;
  unitPrice: number;
  lineTotal: number;
}

/** Unit cost (cents) for a product on a PO of the series whose costs are given */
export function seriesUnitCost(product: SeriesPricedProduct, costs: Record<string, number> | null | undefined): number {
  return costs?.[product.id] ?? product.baseCost;
}

/** Re-prices tire (inventory) lines to the series cost; other lines are kept as they are */
export function priceLinesForSeries<T extends SeriesPricedLine>(
  lines: T[],
  products: SeriesPricedProduct[],
  costs: Record<string, number>
): { lines: T[]; changed: number } {
  let changed = 0;
  const next = lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product || product.itemType !== 'inventory') {
      return line;
    }
    const unitPrice = seriesUnitCost(product, costs);
    if (unitPrice === line.unitPrice) {
      return line;
    }
    changed += 1;
    return { ...line, unitPrice, lineTotal: line.quantityOrdered * unitPrice };
  });
  return { lines: next, changed };
}
