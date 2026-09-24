/**
 * Container Capacity Utilities
 *
 * Handles container capacity calculations for product orders.
 * Used for determining when orders need to be split across multiple containers.
 */

// Standard container capacities by SKU
const CONTAINER_CAPACITIES: Record<string, number> = {
  '290/85R38': 72, // 38" tires - 72 per container
  '380/85R24': 72, // 24" tires - 72 per container
  'BEAD-LOCK': 100, // Bead locks - 100 per container
};

// Default capacity if SKU not found
const DEFAULT_CAPACITY = 72;

/**
 * Get container capacity for a given SKU
 */
export function getContainerCapacity(sku: string): number {
  return CONTAINER_CAPACITIES[sku] || DEFAULT_CAPACITY;
}

/**
 * Check if an order quantity requires container split
 * Returns true if quantity exceeds single container capacity
 */
export function needsContainerSplit(sku: string, quantity: number): boolean {
  const capacity = getContainerCapacity(sku);
  return quantity > capacity;
}

/**
 * Calculate number of containers needed for a quantity
 */
export function calculateContainersNeeded(sku: string, quantity: number): number {
  const capacity = getContainerCapacity(sku);
  return Math.ceil(quantity / capacity);
}

/**
 * Calculate optimal split of quantity across containers
 * Returns array of quantities per container
 */
export function calculateOptimalSplit(
  totalQuantity: number,
  containerCapacity: number
): number[] {
  const containers = Math.ceil(totalQuantity / containerCapacity);
  const baseQuantity = Math.floor(totalQuantity / containers);
  const remainder = totalQuantity % containers;

  const splits: number[] = [];
  for (let i = 0; i < containers; i++) {
    // Distribute remainder across first containers
    splits.push(baseQuantity + (i < remainder ? 1 : 0));
  }

  return splits;
}

/**
 * Get container split suggestions for an order item
 */
export function getContainerSplitSuggestions(
  sku: string,
  quantity: number
): {
  needsSplit: boolean;
  containersNeeded: number;
  capacity: number;
  splits: number[];
} {
  const capacity = getContainerCapacity(sku);
  const needsSplit = needsContainerSplit(sku, quantity);
  const containersNeeded = calculateContainersNeeded(sku, quantity);
  const splits = calculateOptimalSplit(quantity, capacity);

  return {
    needsSplit,
    containersNeeded,
    capacity,
    splits,
  };
}

/**
 * Format split suggestion as human-readable text
 */
export function formatSplitSuggestion(splits: number[]): string {
  if (splits.length === 0) return '';
  if (splits.length === 1) return `${splits[0]} units (1 container)`;

  return splits
    .map((qty, index) => `Container ${index + 1}: ${qty} units`)
    .join(', ');
}
