'use server';

/**
 * Dashboard Repository
 *
 * Database queries for dashboard data.
 * Supports date range filtering for all queries.
 */

import { createClient } from '@/shared/lib/supabase/server';
import type { UnitsBySKUDataPoint, UnitsBySKUChartData, ProductLegendItem, ChannelPerformanceDataPoint, InventoryByLocation, DashboardStat, MarginDataPoint, RevenueDataPoint, DateRange } from '../types';

// Helper to format date as YYYY-MM-DD string
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Color palette for products
const PRODUCT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

/**
 * Get units sold by ALL products grouped by month
 * Uses confirmed/processing/shipped/delivered orders from the specified date range
 * @param dateRange - Optional date range filter. Defaults to last 6 months if not provided.
 */
export async function getUnitsBySKU(dateRange?: DateRange): Promise<UnitsBySKUChartData> {
  const supabase = await createClient();

  // Use provided date range or default to last 6 months
  let startDate: string;
  let endDate: string;

  if (dateRange) {
    startDate = dateRange.startDate;
    endDate = dateRange.endDate;
  } else {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    startDate = formatDateString(sixMonthsAgo);
    endDate = formatDateString(new Date());
  }

  // Query sales_order_items joined with sales_orders and products
  // Only include inventory products (exclude service and non_inventory)
  const { data, error } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      product_id,
      sku,
      sales_orders!inner (
        order_date,
        status,
        deleted_at
      ),
      products!inner (
        id,
        sku,
        name,
        item_type
      )
    `)
    .gte('sales_orders.order_date', startDate)
    .lte('sales_orders.order_date', endDate)
    .is('sales_orders.deleted_at', null)
    .in('sales_orders.status', ['confirmed', 'processing', 'shipped', 'delivered'])
    .eq('products.item_type', 'inventory');

  if (error) {
    console.error('Error fetching units by SKU:', error);
    return { data: [], products: [] };
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Track unique products and their data
  const productMap = new Map<string, { id: string; sku: string; name: string }>();
  const monthlyData: Record<string, Record<string, number>> = {};

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = {};
  }

  // Process results
  if (data) {
    for (const item of data) {
      const salesOrder = item.sales_orders as unknown as { order_date: string } | null;
      const product = item.products as unknown as { id: string; sku: string; name: string } | null;

      if (!salesOrder?.order_date) continue;

      const date = new Date(salesOrder.order_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) continue;

      // Get product identifier
      const productId = product?.id || item.product_id || 'unknown';
      const productSku = product?.sku || item.sku || 'Unknown';
      const productName = product?.name || item.sku || 'Unknown Product';

      // Track product
      if (!productMap.has(productId)) {
        productMap.set(productId, { id: productId, sku: productSku, name: productName });
      }

      // Add quantity
      const dataKey = `units_${productId}`;
      monthlyData[monthKey][dataKey] = (monthlyData[monthKey][dataKey] || 0) + item.quantity;
    }
  }

  // Convert products to legend items
  const products: ProductLegendItem[] = Array.from(productMap.entries()).map(([id, product], index) => ({
    key: `units_${id}`,
    label: product.name.length > 20 ? `${product.name.substring(0, 20)}...` : product.name,
    color: PRODUCT_COLORS[index % PRODUCT_COLORS.length] || '#888888',
  }));

  // Convert to array format with all product keys
  const result: UnitsBySKUDataPoint[] = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const [, month] = key.split('-');
      const monthIndex = parseInt(month || '1', 10) - 1;

      const dataPoint: UnitsBySKUDataPoint = { name: monthNames[monthIndex] || 'Unknown' };

      // Add all product values
      for (const product of products) {
        dataPoint[product.key] = values[product.key] || 0;
      }

      return dataPoint;
    });

  return { data: result, products };
}

// Channel colors
const CHANNEL_COLORS: Record<string, string> = {
  oem: '#3b82f6',    // blue
  dealer: '#10b981', // green
};

/**
 * Get channel performance data (OEM vs Dealer)
 * Groups sales by customer channel
 * @param dateRange - Optional date range filter. Defaults to current month if not provided.
 */
export async function getChannelPerformance(dateRange?: DateRange): Promise<ChannelPerformanceDataPoint[]> {
  const supabase = await createClient();

  // Use provided date range or default to current month
  let startDate: string;
  let endDate: string;

  if (dateRange) {
    startDate = dateRange.startDate;
    endDate = dateRange.endDate;
  } else {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = formatDateString(monthStart);
    endDate = formatDateString(now);
  }

  // Query sales_orders with customer channel
  const { data: ordersData, error: ordersError } = await supabase
    .from('sales_orders')
    .select(`
      id,
      grand_total,
      customer_id,
      customers!inner (
        channel
      )
    `)
    .gte('order_date', startDate)
    .lte('order_date', endDate)
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  if (ordersError) {
    console.error('Error fetching channel orders:', ordersError);
    return [];
  }

  // Get order IDs for units count
  const orderIds = ordersData?.map(o => o.id) || [];

  // Query sales_order_items for units
  let itemsData: { sales_order_id: string; quantity: number }[] = [];
  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from('sales_order_items')
      .select('sales_order_id, quantity')
      .in('sales_order_id', orderIds);

    if (!error && data) {
      itemsData = data;
    }
  }

  // Create a map of order_id -> total units
  const orderUnits: Record<string, number> = {};
  for (const item of itemsData) {
    orderUnits[item.sales_order_id] = (orderUnits[item.sales_order_id] || 0) + item.quantity;
  }

  // Aggregate by channel
  const channelData: Record<string, { revenue: number; units: number }> = {
    oem: { revenue: 0, units: 0 },
    dealer: { revenue: 0, units: 0 },
  };

  if (ordersData) {
    for (const order of ordersData) {
      const customer = order.customers as unknown as { channel: string } | null;
      const channel = customer?.channel?.toLowerCase() || 'dealer';

      if (!channelData[channel]) {
        channelData[channel] = { revenue: 0, units: 0 };
      }

      // grand_total is in cents, convert to dollars
      channelData[channel].revenue += (order.grand_total || 0) / 100;
      channelData[channel].units += orderUnits[order.id] || 0;
    }
  }

  // Convert to array format
  const result: ChannelPerformanceDataPoint[] = Object.entries(channelData)
    .filter(([, data]) => data.revenue > 0 || data.units > 0)
    .map(([channel, data]) => ({
      channel: channel.toUpperCase(),
      revenue: Math.round(data.revenue),
      units: data.units,
      fill: CHANNEL_COLORS[channel] || '#94a3b8',
    }));

  // Sort by revenue descending
  result.sort((a, b) => b.revenue - a.revenue);

  return result;
}

/**
 * Get inventory overview by location
 * Aggregates on_hand, allocated, available across all products per location
 */
export async function getInventoryByLocation(): Promise<InventoryByLocation[]> {
  const supabase = await createClient();

  // Query inventory grouped by location
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('inventory')
    .select(`
      location_id,
      on_hand,
      allocated,
      locations!inner (
        id,
        name,
        location_type
      )
    `);

  if (inventoryError) {
    console.error('Error fetching inventory:', inventoryError);
    return [];
  }

  // Query in-transit shipments (status = 'in_transit' or 'pending')
  // Note: shipment_items.quantity_shipped is the field name
  let inTransitByLocation: Record<string, number> = {};

  try {
    const { data: shipmentsData, error: shipmentsError } = await supabase
      .from('shipments')
      .select(`
        id,
        from_location_id,
        status,
        shipment_items (
          quantity_shipped
        )
      `)
      .in('status', ['pending', 'in_transit'])
      .is('deleted_at', null);

    if (shipmentsError) {
      console.error('Error fetching shipments:', shipmentsError);
    } else if (shipmentsData) {
      // Calculate in-transit by location (items coming FROM this location)
      for (const shipment of shipmentsData) {
        const locationId = shipment.from_location_id;
        if (!locationId) continue;

        const items = shipment.shipment_items as { quantity_shipped: number }[] | null;
        const totalQty = items?.reduce((sum, item) => sum + (item.quantity_shipped || 0), 0) || 0;

        inTransitByLocation[locationId] = (inTransitByLocation[locationId] || 0) + totalQty;
      }
    }
  } catch (err) {
    console.error('Error in shipments query:', err);
  }

  // Aggregate by location
  const locationData: Record<string, {
    name: string;
    locationType: string;
    onHand: number;
    allocated: number;
  }> = {};

  if (inventoryData) {
    for (const inv of inventoryData) {
      const location = inv.locations as unknown as { id: string; name: string; location_type: string };
      const locationId = inv.location_id;

      if (!locationData[locationId]) {
        locationData[locationId] = {
          name: location.name,
          locationType: location.location_type,
          onHand: 0,
          allocated: 0,
        };
      }

      locationData[locationId].onHand += inv.on_hand || 0;
      locationData[locationId].allocated += inv.allocated || 0;
    }
  }

  // Calculate days of cover based on average daily sales (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: salesData } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      warehouse_id,
      sales_orders!inner (
        order_date,
        status,
        deleted_at,
        warehouse_id
      )
    `)
    .gte('sales_orders.order_date', thirtyDaysAgo)
    .is('sales_orders.deleted_at', null)
    .in('sales_orders.status', ['confirmed', 'processing', 'shipped', 'delivered']);

  // Calculate daily sales by location
  const salesByLocation: Record<string, number> = {};
  if (salesData) {
    for (const item of salesData) {
      const salesOrder = item.sales_orders as unknown as { warehouse_id: string | null };
      const locationId = item.warehouse_id || salesOrder?.warehouse_id;
      if (!locationId) continue;

      salesByLocation[locationId] = (salesByLocation[locationId] || 0) + (item.quantity || 0);
    }
  }

  // Convert to array format
  const result: InventoryByLocation[] = Object.entries(locationData).map(([locationId, data]) => {
    const available = data.onHand - data.allocated;
    const inTransit = inTransitByLocation[locationId] || 0;

    // Calculate days of cover: available / (30-day sales / 30)
    const totalSales30Days = salesByLocation[locationId] || 0;
    const dailyAvgSales = totalSales30Days / 30;
    const daysOfCover = dailyAvgSales > 0 ? Math.round(available / dailyAvgSales) : 0;

    return {
      location: data.name,
      onHand: data.onHand,
      allocated: data.allocated,
      available,
      inTransit,
      daysOfCover: data.locationType === 'drop_ship' ? 0 : daysOfCover,
    };
  });

  // Sort: warehouses first, then drop-ship
  result.sort((a, b) => {
    if (a.location === 'Drop-ship') return 1;
    if (b.location === 'Drop-ship') return -1;
    return a.location.localeCompare(b.location);
  });

  return result;
}

/**
 * Get dashboard KPI stats
 * Revenue, Units Sold, Blended Margin, Open Orders
 * @param dateRange - Optional date range filter. Affects revenue and units calculations.
 */
export async function getDashboardStats(dateRange?: DateRange): Promise<DashboardStat[]> {
  const supabase = await createClient();

  // Current dates for comparison periods
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Year-to-date dates
  const currentYearStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1); // Jan 1 of last year
  const lastYearSameDay = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // Same day last year

  // Determine date range for primary calculations
  let primaryStartDate: string;
  let primaryEndDate: string;
  let periodLabel = 'MTD'; // Default label

  if (dateRange) {
    primaryStartDate = dateRange.startDate;
    primaryEndDate = dateRange.endDate;
    // Determine label based on preset
    if (dateRange.preset === 'ytd') periodLabel = 'YTD';
    else if (dateRange.preset === 'last_year') periodLabel = 'Last Year';
    else if (dateRange.preset === 'this_quarter' || dateRange.preset === 'last_quarter') periodLabel = 'QTD';
    else if (dateRange.preset === 'last_6_months') periodLabel = 'Last 6 Mo';
    else if (dateRange.preset === 'last_12_months') periodLabel = 'Last 12 Mo';
    else if (dateRange.preset === 'last_month') periodLabel = 'Last Month';
    else periodLabel = 'MTD';
  } else {
    primaryStartDate = formatDateString(currentMonthStart);
    primaryEndDate = formatDateString(now);
  }

  // Fetch orders for the selected period
  const { data: currentMonthOrders } = await supabase
    .from('sales_orders')
    .select('id, grand_total, subtotal')
    .gte('order_date', primaryStartDate)
    .lte('order_date', primaryEndDate)
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  // Fetch last month orders for comparison
  const { data: lastMonthOrders } = await supabase
    .from('sales_orders')
    .select('id, grand_total, subtotal')
    .gte('order_date', formatDateString(lastMonthStart))
    .lte('order_date', formatDateString(lastMonthEnd))
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  // Fetch YTD orders (Jan 1 to today)
  const { data: ytdOrders } = await supabase
    .from('sales_orders')
    .select('id, grand_total, subtotal')
    .gte('order_date', formatDateString(currentYearStart))
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  // Fetch last year same period orders for YTD comparison
  const { data: lastYearYtdOrders } = await supabase
    .from('sales_orders')
    .select('id, grand_total, subtotal')
    .gte('order_date', formatDateString(lastYearStart))
    .lte('order_date', formatDateString(lastYearSameDay))
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  // Fetch current month items for units
  const currentOrderIds = currentMonthOrders?.map(o => o.id) || [];
  let currentMonthUnits = 0;
  let currentMonthUnits38 = 0;
  let currentMonthUnits24 = 0;

  if (currentOrderIds.length > 0) {
    const { data: itemsData } = await supabase
      .from('sales_order_items')
      .select(`
        quantity,
        products (
          rim_size,
          name
        )
      `)
      .in('sales_order_id', currentOrderIds);

    if (itemsData) {
      for (const item of itemsData) {
        currentMonthUnits += item.quantity || 0;
        const product = item.products as unknown as { rim_size: string | null; name: string | null } | null;

        // Helper function to detect tire size more accurately
        const detectTireSize = (rimSize: string | null | undefined, name: string | null | undefined): '38' | '24' | 'other' => {
          // First try rim_size field (most reliable)
          if (rimSize) {
            const cleanSize = rimSize.replace(/"/g, '').trim();
            if (cleanSize === '38' || cleanSize.startsWith('38')) return '38';
            if (cleanSize === '24' || cleanSize.startsWith('24')) return '24';
          }

          // Fallback to name with stricter pattern matching (avoid false positives)
          if (name) {
            const lowerName = name.toLowerCase();
            // Match patterns like "38\"", "38 inch", "38in", "r38" but not "380" or "238"
            if (/\b38["'\s]|38\s*inch|38in|\sr38\b/i.test(lowerName)) return '38';
            if (/\b24["'\s]|24\s*inch|24in|\sr24\b/i.test(lowerName)) return '24';
          }

          return 'other';
        };

        const tireSize = detectTireSize(product?.rim_size, product?.name);
        if (tireSize === '38') {
          currentMonthUnits38 += item.quantity || 0;
        } else if (tireSize === '24') {
          currentMonthUnits24 += item.quantity || 0;
        }
      }
    }
  }

  // Fetch last month items for units comparison
  const lastOrderIds = lastMonthOrders?.map(o => o.id) || [];
  let lastMonthUnits = 0;

  if (lastOrderIds.length > 0) {
    const { data: lastItemsData } = await supabase
      .from('sales_order_items')
      .select('quantity')
      .in('sales_order_id', lastOrderIds);

    if (lastItemsData) {
      lastMonthUnits = lastItemsData.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
  }

  // Fetch YTD items for units and margin calculation
  const ytdOrderIds = ytdOrders?.map(o => o.id) || [];
  let ytdUnits = 0;
  let ytdUnits38 = 0;
  let ytdUnits24 = 0;
  let ytdTotalRevenue = 0;
  let ytdTotalCost = 0;

  if (ytdOrderIds.length > 0) {
    const { data: ytdItemsData } = await supabase
      .from('sales_order_items')
      .select(`
        quantity,
        unit_price,
        products (
          rim_size,
          name,
          base_cost
        )
      `)
      .in('sales_order_id', ytdOrderIds);

    if (ytdItemsData) {
      // Helper function to detect tire size more accurately
      const detectTireSize = (rimSize: string | null | undefined, name: string | null | undefined): '38' | '24' | 'other' => {
        // First try rim_size field (most reliable)
        if (rimSize) {
          const cleanSize = rimSize.replace(/"/g, '').trim();
          if (cleanSize === '38' || cleanSize.startsWith('38')) return '38';
          if (cleanSize === '24' || cleanSize.startsWith('24')) return '24';
        }

        // Fallback to name with stricter pattern matching
        if (name) {
          const lowerName = name.toLowerCase();
          if (/\b38["'\s]|38\s*inch|38in|\sr38\b/i.test(lowerName)) return '38';
          if (/\b24["'\s]|24\s*inch|24in|\sr24\b/i.test(lowerName)) return '24';
        }

        return 'other';
      };

      for (const item of ytdItemsData) {
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const product = item.products as unknown as { rim_size: string | null; name: string | null; base_cost: number | null } | null;
        const baseCost = product?.base_cost || 0;

        ytdUnits += quantity;
        ytdTotalRevenue += unitPrice * quantity;
        ytdTotalCost += baseCost * quantity;

        const tireSize = detectTireSize(product?.rim_size, product?.name);
        if (tireSize === '38') {
          ytdUnits38 += quantity;
        } else if (tireSize === '24') {
          ytdUnits24 += quantity;
        }
      }
    }
  }

  // Fetch last year YTD items for units and margin comparison
  const lastYearYtdOrderIds = lastYearYtdOrders?.map(o => o.id) || [];
  let lastYearYtdUnits = 0;
  let lastYearYtdTotalRevenue = 0;
  let lastYearYtdTotalCost = 0;

  if (lastYearYtdOrderIds.length > 0) {
    const { data: lastYearYtdItemsData } = await supabase
      .from('sales_order_items')
      .select(`
        quantity,
        unit_price,
        products (
          base_cost
        )
      `)
      .in('sales_order_id', lastYearYtdOrderIds);

    if (lastYearYtdItemsData) {
      for (const item of lastYearYtdItemsData) {
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0;
        const product = item.products as unknown as { base_cost: number | null } | null;
        const baseCost = product?.base_cost || 0;

        lastYearYtdUnits += quantity;
        lastYearYtdTotalRevenue += unitPrice * quantity;
        lastYearYtdTotalCost += baseCost * quantity;
      }
    }
  }

  // Fetch open orders count
  const { count: openOrdersCount } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing']);

  // Calculate last month open orders for comparison
  const { count: lastMonthOpenCount } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing'])
    .lte('created_at', lastMonthEnd.toISOString());

  // Calculate open orders value
  const { data: openOrdersData } = await supabase
    .from('sales_orders')
    .select('grand_total')
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing']);

  const openOrdersValue = openOrdersData?.reduce((sum, o) => sum + (o.grand_total || 0), 0) || 0;

  // Calculate metrics
  const currentRevenue = currentMonthOrders?.reduce((sum, o) => sum + (o.grand_total || 0), 0) || 0;
  const lastRevenue = lastMonthOrders?.reduce((sum, o) => sum + (o.grand_total || 0), 0) || 0;

  // Calculate YTD metrics
  const ytdRevenue = ytdOrders?.reduce((sum, o) => sum + (o.grand_total || 0), 0) || 0;
  const lastYearYtdRevenue = lastYearYtdOrders?.reduce((sum, o) => sum + (o.grand_total || 0), 0) || 0;
  const ytdRevenueChange = lastYearYtdRevenue > 0 ? ((ytdRevenue - lastYearYtdRevenue) / lastYearYtdRevenue) * 100 : 0;
  const ytdUnitsChange = lastYearYtdUnits > 0 ? ((ytdUnits - lastYearYtdUnits) / lastYearYtdUnits) * 100 : 0;

  // Calculate YTD Blended Margin (real data from products.base_cost)
  const ytdBlendedMargin = ytdTotalRevenue > 0
    ? ((ytdTotalRevenue - ytdTotalCost) / ytdTotalRevenue) * 100
    : 0;
  const lastYearYtdBlendedMargin = lastYearYtdTotalRevenue > 0
    ? ((lastYearYtdTotalRevenue - lastYearYtdTotalCost) / lastYearYtdTotalRevenue) * 100
    : 0;
  const marginChange = ytdBlendedMargin - lastYearYtdBlendedMargin; // Absolute difference in margin %

  // Calculate changes
  const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;
  const unitsChange = lastMonthUnits > 0 ? ((currentMonthUnits - lastMonthUnits) / lastMonthUnits) * 100 : 0;
  const openOrdersChange = (openOrdersCount || 0) - (lastMonthOpenCount || 0);

  // Format currency
  const formatCurrency = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000000) {
      return `$${(dollars / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(dollars).toLocaleString()}`;
  };

  // Build stats array
  const stats: DashboardStat[] = [
    {
      id: 'revenue-mtd',
      title: `Revenue (${periodLabel})`,
      value: formatCurrency(currentRevenue),
      change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
      trend: revenueChange >= 0 ? 'up' : 'down',
      icon: 'dollar-sign',
      color: 'bg-emerald-500',
      target: '$220,000',
    },
    {
      id: 'revenue-ytd',
      title: 'Revenue (YTD)',
      value: formatCurrency(ytdRevenue),
      change: `${ytdRevenueChange >= 0 ? '+' : ''}${ytdRevenueChange.toFixed(1)}%`,
      trend: ytdRevenueChange >= 0 ? 'up' : 'down',
      icon: 'trending-up',
      color: 'bg-teal-500',
      subtitle: 'vs same period last year',
    },
    {
      id: 'units-sold',
      title: `Units Sold (${periodLabel})`,
      value: currentMonthUnits.toLocaleString(),
      change: `${unitsChange >= 0 ? '+' : ''}${unitsChange.toFixed(1)}%`,
      trend: unitsChange >= 0 ? 'up' : 'down',
      icon: 'package',
      color: 'bg-blue-500',
      subtitle: `38": ${currentMonthUnits38} | 24": ${currentMonthUnits24}`,
    },
    {
      id: 'units-sold-ytd',
      title: 'Units Sold (YTD)',
      value: ytdUnits.toLocaleString(),
      change: `${ytdUnitsChange >= 0 ? '+' : ''}${ytdUnitsChange.toFixed(1)}%`,
      trend: ytdUnitsChange >= 0 ? 'up' : 'down',
      icon: 'package',
      color: 'bg-indigo-500',
      subtitle: `38": ${ytdUnits38} | 24": ${ytdUnits24}`,
    },
    {
      id: 'blended-margin',
      title: 'Blended Margin (YTD)',
      value: `${ytdBlendedMargin.toFixed(1)}%`,
      change: `${marginChange >= 0 ? '+' : ''}${marginChange.toFixed(1)}%`,
      trend: marginChange >= 0 ? 'up' : 'down',
      icon: 'percent',
      color: 'bg-violet-500',
      subtitle: 'vs same period last year',
      target: '30%',
    },
    {
      id: 'open-orders',
      title: 'Open Orders',
      value: (openOrdersCount || 0).toString(),
      change: `${openOrdersChange >= 0 ? '+' : ''}${openOrdersChange}`,
      trend: openOrdersChange <= 0 ? 'down' : 'up',
      icon: 'shopping-cart',
      color: 'bg-orange-500',
      subtitle: formatCurrency(openOrdersValue) + ' value',
    },
  ];

  return stats;
}

/**
 * Get margin analysis data for last 6 months
 * Calculates monthly margin % based on selling price vs cost
 * @param dateRange - Optional date range filter. Defaults to last 6 months if not provided.
 */
export async function getMarginAnalysis(dateRange?: DateRange): Promise<MarginDataPoint[]> {
  const supabase = await createClient();

  // Use provided date range or default to last 6 months
  let startDate: string;
  let endDate: string;

  if (dateRange) {
    startDate = dateRange.startDate;
    endDate = dateRange.endDate;
  } else {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    startDate = formatDateString(sixMonthsAgo);
    endDate = formatDateString(new Date());
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Query sales_order_items with products for cost data
  const { data, error } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      unit_price,
      product_id,
      sales_orders!inner (
        order_date,
        status,
        deleted_at
      ),
      products (
        id,
        base_cost,
        rim_size,
        name
      )
    `)
    .gte('sales_orders.order_date', startDate)
    .lte('sales_orders.order_date', endDate)
    .is('sales_orders.deleted_at', null)
    .in('sales_orders.status', ['confirmed', 'processing', 'shipped', 'delivered']);

  if (error) {
    console.error('Error fetching margin data:', error);
    return [];
  }

  // Initialize monthly data structure
  interface MonthlyMarginData {
    totalRevenue: number;
    totalCost: number;
    revenue38: number;
    cost38: number;
    revenue24: number;
    cost24: number;
  }

  const monthlyData: Record<string, MonthlyMarginData> = {};

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = {
      totalRevenue: 0,
      totalCost: 0,
      revenue38: 0,
      cost38: 0,
      revenue24: 0,
      cost24: 0,
    };
  }

  // Helper function to detect tire size more accurately
  const detectTireSize = (rimSize: string | null | undefined, name: string | null | undefined): '38' | '24' | 'other' => {
    // First try rim_size field (most reliable)
    if (rimSize) {
      const cleanSize = rimSize.replace(/"/g, '').trim();
      if (cleanSize === '38' || cleanSize.startsWith('38')) return '38';
      if (cleanSize === '24' || cleanSize.startsWith('24')) return '24';
    }

    // Fallback to name with stricter pattern matching
    if (name) {
      const lowerName = name.toLowerCase();
      if (/\b38["'\s]|38\s*inch|38in|\sr38\b/i.test(lowerName)) return '38';
      if (/\b24["'\s]|24\s*inch|24in|\sr24\b/i.test(lowerName)) return '24';
    }

    return 'other';
  };

  // Process results
  if (data) {
    for (const item of data) {
      const salesOrder = item.sales_orders as unknown as { order_date: string } | null;
      const product = item.products as unknown as { id: string; base_cost: number; rim_size: string | null; name: string | null } | null;

      if (!salesOrder?.order_date) continue;

      const date = new Date(salesOrder.order_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) continue;

      const quantity = item.quantity || 0;
      const unitPrice = item.unit_price || 0; // Selling price in cents
      const baseCost = product?.base_cost || 0; // Cost in cents

      const lineRevenue = unitPrice * quantity;
      const lineCost = baseCost * quantity;

      monthlyData[monthKey].totalRevenue += lineRevenue;
      monthlyData[monthKey].totalCost += lineCost;

      // Track 38" and 24" separately with improved detection
      const tireSize = detectTireSize(product?.rim_size, product?.name);
      if (tireSize === '38') {
        monthlyData[monthKey].revenue38 += lineRevenue;
        monthlyData[monthKey].cost38 += lineCost;
      } else if (tireSize === '24') {
        monthlyData[monthKey].revenue24 += lineRevenue;
        monthlyData[monthKey].cost24 += lineCost;
      }
    }
  }

  // Convert to array format with margin calculations
  const result: MarginDataPoint[] = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const [, month] = key.split('-');
      const monthIndex = parseInt(month || '1', 10) - 1;

      // Calculate overall margin %
      const overallMargin = values.totalRevenue > 0
        ? ((values.totalRevenue - values.totalCost) / values.totalRevenue) * 100
        : 0;

      // Calculate 38" margin
      const margin38 = values.revenue38 > 0
        ? ((values.revenue38 - values.cost38) / values.revenue38) * 100
        : 0;

      // Calculate 24" margin
      const margin24 = values.revenue24 > 0
        ? ((values.revenue24 - values.cost24) / values.revenue24) * 100
        : 0;

      return {
        month: monthNames[monthIndex] || 'Unknown',
        margin: Math.round(overallMargin * 10) / 10, // Round to 1 decimal
        target: 30, // Target margin is 30%
        sku38Margin: Math.round(margin38 * 10) / 10,
        sku24Margin: Math.round(margin24 * 10) / 10,
      };
    });

  return result;
}

/**
 * Get revenue trend data for last 8 months
 * Shows current year revenue, target, and last year comparison
 * @param dateRange - Optional date range filter. Affects the data period shown.
 */
export async function getRevenueTrend(dateRange?: DateRange): Promise<RevenueDataPoint[]> {
  const supabase = await createClient();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get current date info
  const now = new Date();

  // Determine date range - if provided, use it; otherwise use last 8 months
  let queryStartDate: string;
  let queryEndDate: string;

  if (dateRange) {
    queryStartDate = dateRange.startDate;
    queryEndDate = dateRange.endDate;
  } else {
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 7);
    eightMonthsAgo.setDate(1);
    queryStartDate = formatDateString(eightMonthsAgo);
    queryEndDate = formatDateString(now);
  }

  // Query current year orders
  const { data: currentYearData, error: currentError } = await supabase
    .from('sales_orders')
    .select('order_date, grand_total')
    .gte('order_date', queryStartDate)
    .lte('order_date', queryEndDate)
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  if (currentError) {
    console.error('Error fetching current year revenue:', currentError);
  }

  // Calculate same date range for last year (subtract 1 year from start and end dates)
  const startDateObj = new Date(queryStartDate);
  const endDateObj = new Date(queryEndDate);
  const lastYearStartDate = new Date(startDateObj.getFullYear() - 1, startDateObj.getMonth(), startDateObj.getDate());
  const lastYearEndDate = new Date(endDateObj.getFullYear() - 1, endDateObj.getMonth(), endDateObj.getDate());

  // Query last year orders (same date range, one year ago)
  const { data: lastYearData, error: lastError } = await supabase
    .from('sales_orders')
    .select('order_date, grand_total')
    .gte('order_date', formatDateString(lastYearStartDate))
    .lte('order_date', formatDateString(lastYearEndDate))
    .is('deleted_at', null)
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

  if (lastError) {
    console.error('Error fetching last year revenue:', lastError);
  }

  // Initialize monthly data
  const monthlyRevenue: Record<string, number> = {};
  const lastYearRevenue: Record<string, number> = {};

  // Initialize last 8 months
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = String(d.getMonth() + 1).padStart(2, '0');
    monthlyRevenue[monthKey] = 0;
    lastYearRevenue[monthKey] = 0;
  }

  // Process current year data
  if (currentYearData) {
    for (const order of currentYearData) {
      if (!order.order_date) continue;
      const date = new Date(order.order_date);
      const monthKey = String(date.getMonth() + 1).padStart(2, '0');

      if (monthlyRevenue[monthKey] !== undefined) {
        monthlyRevenue[monthKey] += (order.grand_total || 0) / 100; // cents to dollars
      }
    }
  }

  // Process last year data
  if (lastYearData) {
    for (const order of lastYearData) {
      if (!order.order_date) continue;
      const date = new Date(order.order_date);
      const monthKey = String(date.getMonth() + 1).padStart(2, '0');

      if (lastYearRevenue[monthKey] !== undefined) {
        lastYearRevenue[monthKey] += (order.grand_total || 0) / 100; // cents to dollars
      }
    }
  }

  // TODO: Move to database table (monthly_targets) for dynamic updates
  // For demo: Update this value here if target changes
  // Long-term: Create `monthly_targets` table with year/month/target_amount columns
  const MONTHLY_TARGET = 220000; // $220,000 per month (hardcoded - update here if needed)

  // Convert to array format
  const result: RevenueDataPoint[] = Object.keys(monthlyRevenue)
    .sort((a, b) => {
      // Sort by actual calendar order for the 8-month window
      const aMonth = parseInt(a, 10);
      const bMonth = parseInt(b, 10);
      const currentMonth = now.getMonth() + 1;

      // Adjust for wrapping around the year
      const aAdjusted = aMonth <= currentMonth ? aMonth + 12 : aMonth;
      const bAdjusted = bMonth <= currentMonth ? bMonth + 12 : bMonth;

      return aAdjusted - bAdjusted;
    })
    .map((monthKey) => {
      const monthIndex = parseInt(monthKey, 10) - 1;

      return {
        month: monthNames[monthIndex] || 'Unknown',
        revenue: Math.round(monthlyRevenue[monthKey] || 0),
        target: MONTHLY_TARGET,
        lastYear: Math.round(lastYearRevenue[monthKey] || 0),
      };
    });

  return result;
}
