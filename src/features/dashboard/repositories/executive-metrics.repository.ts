/**
 * Executive Metrics Repository
 *
 * Database queries for Executive Dashboard tables
 * - Table 1.2: Working Capital Position
 * - Table 2.1: Profitability
 * - Table 2.2: Per Tire Economics
 * - Table 2.4: Backlog Summary
 * - Table 4.2: Current Inventory
 */

import { createClient } from '@/shared/lib/supabase/server';
import type { DateRange } from '../types';

// ============================================
// TABLE 2.1 - PROFITABILITY
// ============================================

/**
 * Get Revenue data (Definition 3.1)
 * Revenue = Gross Recognized Sales - Discounts - Returns and Credits
 */
export async function getRevenueData(dateRange: DateRange) {
  const supabase = await createClient();

  // Step 1: Get Gross Sales and Discounts from invoices
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('grand_total, discount_total')
    .in('status', ['sent', 'partial', 'paid'])
    .gte('invoice_date', dateRange.startDate)
    .lte('invoice_date', dateRange.endDate);

  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError);
    return { revenue: 0, grossSales: 0, discounts: 0, returns: 0 };
  }

  const grossSales = invoices?.reduce((sum: number, inv: { grand_total?: number }) => sum + (inv.grand_total || 0), 0) || 0;
  const discounts = invoices?.reduce((sum: number, inv: { discount_total?: number }) => sum + (inv.discount_total || 0), 0) || 0;

  // Step 2: Get Returns and Credits
  const { data: credits } = await supabase
    .from('credit_notes')
    .select('grand_total')
    .eq('status', 'approved')
    .gte('created_at', dateRange.startDate)
    .lte('created_at', dateRange.endDate);

  const returns = credits?.reduce((sum: number, cn: { grand_total?: number }) => sum + (cn.grand_total || 0), 0) || 0;

  // Step 3: Calculate Net Revenue (Definition 3.1)
  const revenue = grossSales - discounts - returns;

  return {
    revenue,
    grossSales,
    discounts,
    returns,
  };
}

/**
 * Get COGS (Cost of Goods Sold)
 * From delivered sales order items
 */
export async function getCOGSData(dateRange: DateRange) {
  const supabase = await createClient();

  // Get cost from products table via product_id
  const { data: items, error } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      product_id,
      products!inner (
        unit_cost
      ),
      sales_orders!inner (
        order_date,
        status
      )
    `)
    .eq('sales_orders.status', 'delivered')
    .gte('sales_orders.order_date', dateRange.startDate)
    .lte('sales_orders.order_date', dateRange.endDate);

  if (error) {
    console.error('Error fetching COGS:', error);
    return 0;
  }

  const cogs = items?.reduce((sum: number, item: any) => {
    const unitCost = Array.isArray(item.products) ? item.products[0]?.unit_cost : item.products?.unit_cost;
    return sum + ((item.quantity || 0) * (unitCost || 0));
  }, 0) || 0;

  return cogs;
}

/**
 * Get complete profitability data
 * Returns Revenue, COGS, Gross Profit, and percentages
 */
export async function getProfitabilityData(dateRange: DateRange) {
  const revenueData = await getRevenueData(dateRange);
  const cogs = await getCOGSData(dateRange);

  // Calculate Gross Profit (Definition 3.2)
  const grossProfit = revenueData.revenue - cogs;
  const grossProfitPercent = revenueData.revenue > 0
    ? (grossProfit / revenueData.revenue) * 100
    : 0;

  const cogsPercent = revenueData.revenue > 0
    ? (cogs / revenueData.revenue) * 100
    : 0;

  return {
    revenue: revenueData.revenue,
    cogs,
    cogsPercent,
    grossProfit,
    grossProfitPercent,
    // Breakdown for transparency
    breakdown: {
      grossSales: revenueData.grossSales,
      discounts: revenueData.discounts,
      returns: revenueData.returns,
    },
  };
}

// ============================================
// TABLE 2.2 - PER TIRE ECONOMICS
// ============================================

/**
 * Get Tires Sold count
 * Sum of quantity from delivered orders
 */
export async function getTiresSoldData(dateRange: DateRange) {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      sales_orders!inner (
        order_date,
        status
      )
    `)
    .eq('sales_orders.status', 'delivered')
    .gte('sales_orders.order_date', dateRange.startDate)
    .lte('sales_orders.order_date', dateRange.endDate);

  if (error) {
    console.error('Error fetching tires sold:', error);
    return 0;
  }

  const tiresSold = items?.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0) || 0;

  return tiresSold;
}

/**
 * Get Per Tire Economics
 * Revenue/Tire, COGS/Tire, GP/Tire
 */
export async function getPerTireEconomics(dateRange: DateRange) {
  const profitability = await getProfitabilityData(dateRange);
  const tiresSold = await getTiresSoldData(dateRange);

  if (tiresSold === 0) {
    return {
      tiresSold: 0,
      revenuePerTire: 0,
      cogsPerTire: 0,
      gpPerTire: 0,
    };
  }

  return {
    tiresSold,
    revenuePerTire: profitability.revenue / tiresSold,
    cogsPerTire: profitability.cogs / tiresSold,
    gpPerTire: profitability.grossProfit / tiresSold,
  };
}

// ============================================
// TABLE 1.2 - WORKING CAPITAL POSITION
// ============================================

/**
 * Get Accounts Receivable (Current)
 * Sum of unpaid invoices
 */
export async function getAccountsReceivableData() {
  const supabase = await createClient();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('grand_total, due_date')
    .in('status', ['sent', 'partial']);

  if (error) {
    console.error('Error fetching AR:', error);
    return { arCurrent: 0, arWeightedTiming: 0 };
  }

  const arCurrent = invoices?.reduce((sum: number, inv: { grand_total?: number }) => sum + (inv.grand_total || 0), 0) || 0;

  // Calculate weighted timing (weighted days until due)
  let weightedSum = 0;
  let totalAmount = 0;

  invoices?.forEach((inv: { due_date?: string; grand_total?: number }) => {
    if (inv.due_date && inv.grand_total) {
      const daysUntilDue = Math.max(0,
        Math.floor((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      );
      weightedSum += inv.grand_total * daysUntilDue;
      totalAmount += inv.grand_total;
    }
  });

  const arWeightedTiming = totalAmount > 0 ? Math.round(weightedSum / totalAmount) : 0;

  return {
    arCurrent,
    arWeightedTiming,
  };
}

/**
 * Get Accounts Payable (Current)
 * Sum from unpaid purchase orders
 */
export async function getAccountsPayableData() {
  const supabase = await createClient();

  const { data: poItems, error } = await supabase
    .from('purchase_order_items')
    .select(`
      quantity,
      unit_cost,
      purchase_orders!inner (
        status
      )
    `)
    .in('purchase_orders.status', ['confirmed', 'in_production', 'ready_to_ship']);

  if (error) {
    console.error('Error fetching AP:', error);
    return { apCurrent: 0, apWeightedTiming: 0 };
  }

  const apCurrent = poItems?.reduce((sum, item) => {
    return sum + ((item.quantity || 0) * (item.unit_cost || 0));
  }, 0) || 0;

  // AP Weighted Timing would need payment_due_date field on PO
  // For now, returning 0
  const apWeightedTiming = 0;

  return {
    apCurrent,
    apWeightedTiming,
  };
}

/**
 * Get Inventory Value (Current)
 * Sum of on_hand × unit_cost
 */
export async function getInventoryValueData() {
  const supabase = await createClient();

  const { data: inventory, error } = await supabase
    .from('inventory')
    .select(`
      on_hand,
      products!inner (
        unit_cost
      )
    `)
    .gt('on_hand', 0);

  if (error) {
    console.error('Error fetching inventory value:', error);
    return 0;
  }

  const inventoryValue = inventory?.reduce((sum, item: any) => {
    const unitCost = Array.isArray(item.products) ? item.products[0]?.unit_cost : item.products?.unit_cost;
    return sum + ((item.on_hand || 0) * (unitCost || 0));
  }, 0) || 0;

  return inventoryValue;
}

/**
 * Get Working Capital Position
 */
export async function getWorkingCapitalPosition() {
  const ar = await getAccountsReceivableData();
  const ap = await getAccountsPayableData();
  const inventory = await getInventoryValueData();

  return {
    accountsReceivable: ar.arCurrent,
    arWeightedTiming: ar.arWeightedTiming,
    accountsPayable: ap.apCurrent,
    apWeightedTiming: ap.apWeightedTiming,
    inventory,
  };
}

// ============================================
// TABLE 4.2 - CURRENT INVENTORY
// ============================================

/**
 * Get Current Inventory data
 */
export async function getCurrentInventoryData() {
  const supabase = await createClient();

  const { data: inventory, error } = await supabase
    .from('inventory')
    .select(`
      on_hand,
      allocated,
      products!inner (
        unit_cost,
        item_type
      )
    `)
    .gt('on_hand', 0);

  if (error) {
    console.error('Error fetching current inventory:', error);
    return {
      inventoryAtCost: 0,
      tiresOnHand: 0,
      costPerTire: 0,
      uncommittedInventory: 0,
    };
  }

  let inventoryAtCost = 0;
  let tiresOnHand = 0;
  let uncommittedInventory = 0;

  inventory?.forEach((item: any) => {
    const onHand = item.on_hand || 0;
    const unitCost = Array.isArray(item.products) ? item.products[0]?.unit_cost : item.products?.unit_cost;
    const cost = unitCost || 0;
    const allocated = item.allocated || 0;

    inventoryAtCost += onHand * cost;
    tiresOnHand += onHand;
    uncommittedInventory += Math.max(0, onHand - allocated);
  });

  const costPerTire = tiresOnHand > 0 ? inventoryAtCost / tiresOnHand : 0;

  return {
    inventoryAtCost,
    tiresOnHand,
    costPerTire,
    uncommittedInventory,
  };
}

/**
 * Get Uncommitted Months of Supply
 * Calculate based on last 3 months' sales
 */
export async function getUncommittedMonthsOfSupply() {
  const supabase = await createClient();

  // Get last 3 months sales
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: items, error } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      sales_orders!inner (
        order_date,
        status
      )
    `)
    .eq('sales_orders.status', 'delivered')
    .gte('sales_orders.order_date', threeMonthsAgo.toISOString());

  if (error) {
    console.error('Error fetching sales history:', error);
    return 0;
  }

  const totalSoldLast3Months = items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  const avgMonthlySales = totalSoldLast3Months / 3;

  if (avgMonthlySales === 0) {
    return 0;
  }

  const inventoryData = await getCurrentInventoryData();
  const monthsOfSupply = inventoryData.uncommittedInventory / avgMonthlySales;

  return monthsOfSupply;
}

// ============================================
// TABLE 2.4 - BACKLOG SUMMARY
// ============================================

/**
 * Get Backlog data
 * Unfulfilled firm customer orders
 */
export async function getBacklogData() {
  const supabase = await createClient();

  // Get cost from products table via product_id (sales_order_items doesn't have unit_cost)
  const { data: items, error } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      unit_price,
      product_id,
      products!inner (
        unit_cost
      ),
      sales_orders!inner (
        status
      )
    `)
    .in('sales_orders.status', ['confirmed', 'processing']);

  if (error) {
    console.error('Error fetching backlog:', error);
    return {
      backlogTires: 0,
      backlogRevenue: 0,
      revenuePerTire: 0,
      backlogGrossProfit: 0,
      gpPerTire: 0,
      gpPercent: 0,
    };
  }

  let backlogTires = 0;
  let backlogRevenue = 0;
  let backlogGrossProfit = 0;

  items?.forEach((item: any) => {
    const qty = item.quantity || 0;
    const price = item.unit_price || 0;
    const unitCost = Array.isArray(item.products) ? item.products[0]?.unit_cost : item.products?.unit_cost;
    const cost = unitCost || 0;

    backlogTires += qty;
    backlogRevenue += qty * price;
    backlogGrossProfit += qty * (price - cost);
  });

  const revenuePerTire = backlogTires > 0 ? backlogRevenue / backlogTires : 0;
  const gpPerTire = backlogTires > 0 ? backlogGrossProfit / backlogTires : 0;
  const gpPercent = backlogRevenue > 0 ? (backlogGrossProfit / backlogRevenue) * 100 : 0;

  return {
    backlogTires,
    backlogRevenue,
    revenuePerTire,
    backlogGrossProfit,
    gpPerTire,
    gpPercent,
  };
}
