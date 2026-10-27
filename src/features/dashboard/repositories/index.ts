'use server';

/**
 * Dashboard Repository
 *
 * Database queries for dashboard data.
 * Supports date range filtering for all queries.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import { loadRecognizedSales, summarizeRecognizedSales } from '../services/recognized-sales.service';
import type { UnitsBySKUDataPoint, UnitsBySKUChartData, ProductLegendItem, ChannelPerformanceDataPoint, InventoryByLocation, DashboardStat, MarginDataPoint, RevenueDataPoint, DateRange, CommissionRevenueStats } from '../types';

// Helper to format date as YYYY-MM-DD string
/** Open Orders = sales orders being worked on (agreed definition, Aug 27 2025) */
const OPEN_ORDER_STATUSES = ['confirmed', 'processing'];

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
 * Get units by SKU from shipments (inventory coming IN)
 * Uses shipment_items with eta_to_port for date filtering
 * Shows units arriving per SKU per month based on ETA to US port
 * @param dateRange - Optional date range filter. Defaults to last 6 months if not provided.
 */
export async function getUnitsBySKU(dateRange?: DateRange): Promise<UnitsBySKUChartData> {
  const supabase = createAdminClient();

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

  // Query shipment_items joined with shipments and products
  // Filter by eta_to_port (ETA to US Port) - this is the key date for tracking incoming inventory
  // Only include inventory products (exclude service and non_inventory)
  const { data, error } = await supabase
    .from('shipment_items')
    .select(`
      quantity_shipped,
      product_id,
      sku,
      shipments!inner (
        eta_to_port,
        confirmed_eta,
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
    .gte('shipments.eta_to_port', startDate)
    .lte('shipments.eta_to_port', endDate)
    .is('shipments.deleted_at', null)
    .eq('products.item_type', 'inventory');

  if (error) {
    console.error('Error fetching units by SKU from shipments:', error);
    return { data: [], products: [] };
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Track unique products and their data
  const productMap = new Map<string, { id: string; sku: string; name: string }>();
  const monthlyData: Record<string, Record<string, number>> = {};

  // Initialize months based on actual date range (not hardcoded last 6 months)
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  // Create month keys from start to end of date range
  const currentMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (currentMonth <= rangeEnd) {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = {};
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  // Process results
  if (data) {
    for (const item of data) {
      const shipment = item.shipments as unknown as { eta_to_port: string } | null;
      const product = item.products as unknown as { id: string; sku: string; name: string } | null;

      if (!shipment?.eta_to_port) continue;

      const date = new Date(shipment.eta_to_port);
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

      // Add quantity (use quantity_shipped from shipment_items)
      const dataKey = `units_${productId}`;
      monthlyData[monthKey][dataKey] = (monthlyData[monthKey][dataKey] || 0) + item.quantity_shipped;
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

  // Recognized tire sales (Ankur 3.1, same rule as the Executive tabs):
  // tire lines of firm orders delivered in the period, by customer channel
  let recognized;
  try {
    recognized = await loadRecognizedSales();
  } catch (error) {
    console.error('Error fetching channel sales:', error);
    return [];
  }

  // Aggregate by channel
  const channelData: Record<string, { revenue: number; units: number }> = {
    oem: { revenue: 0, units: 0 },
    dealer: { revenue: 0, units: 0 },
  };

  for (const line of recognized.lines) {
    if (!line.isTire || line.date < startDate || line.date > endDate) {
      continue;
    }
    const channel = line.customerChannel?.toLowerCase() || 'dealer';
    if (!channelData[channel]) {
      channelData[channel] = { revenue: 0, units: 0 };
    }
    // line_total is in cents, convert to dollars
    channelData[channel].revenue += line.lineTotal / 100;
    channelData[channel].units += line.quantity;
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
  const supabase = createAdminClient();

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
  const supabase = createAdminClient();

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

  // DEBUG: Log the date range being used
  console.log('📅 Dashboard Stats Date Range:', {
    primaryStartDate,
    primaryEndDate,
    periodLabel,
    currentMonthStart: currentMonthStart.toISOString(),
    now: now.toISOString(),
  });

  // ===================================================================
  // RECOGNIZED SALES (Ankur's Definitions 3.1-3.4, same rule as the
  // Executive tabs): revenue, units and margin come from the tire lines of
  // firm sales orders delivered in the period (recognized-sales.service).
  // Revenue = tire line totals (excl. tax) − credit notes; commission-only
  // orders and service lines (commission, handling) are not tire revenue.
  // ===================================================================
  const recognized = await loadRecognizedSales();
  const current = summarizeRecognizedSales(recognized, primaryStartDate, primaryEndDate);
  const lastMonth = summarizeRecognizedSales(recognized, formatDateString(lastMonthStart), formatDateString(lastMonthEnd));
  const ytd = summarizeRecognizedSales(recognized, formatDateString(currentYearStart), formatDateString(now));
  const lastYearYtd = summarizeRecognizedSales(recognized, formatDateString(lastYearStart), formatDateString(lastYearSameDay));

  const currentRevenue = current.revenue;
  const lastRevenue = lastMonth.revenue;
  const ytdNetRevenue = ytd.revenue;
  const lastYearYtdRevenue = lastYearYtd.revenue;
  const ytdNetRevenueChange = lastYearYtdRevenue > 0
    ? ((ytdNetRevenue - lastYearYtdRevenue) / lastYearYtdRevenue) * 100
    : 0;

  const currentMonthUnits = current.units;
  const currentMonthUnits38 = current.units38;
  const currentMonthUnits24 = current.units24;
  const lastMonthUnits = lastMonth.units;
  const ytdUnits = ytd.units;
  const ytdUnits38 = ytd.units38;
  const ytdUnits24 = ytd.units24;
  const lastYearYtdUnits = lastYearYtd.units;

  // Blended margin: the same recognized tire revenue and its COGS
  const ytdTotalRevenue = ytd.revenue;
  const ytdTotalCost = ytd.cogs;
  const lastYearYtdTotalRevenue = lastYearYtd.revenue;
  const lastYearYtdTotalCost = lastYearYtd.cogs;

  // Open Orders: sales orders with status confirmed or processing (not deleted)
  const { data: openOrdersData, count: openOrdersCount } = await supabase
    .from('sales_orders')
    .select('grand_total', { count: 'exact' })
    .in('status', OPEN_ORDER_STATUSES)
    .is('deleted_at', null);

  // Comparison: the same open orders that were already placed by the end of last month
  const { count: lastMonthOpenCount } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .in('status', OPEN_ORDER_STATUSES)
    .is('deleted_at', null)
    .lte('order_date', formatDateString(lastMonthEnd));

  const openOrdersValue = openOrdersData?.reduce((sum, so) => sum + (so.grand_total || 0), 0) || 0;

  // Units change calculation
  const ytdUnitsChange = lastYearYtdUnits > 0 ? ((ytdUnits - lastYearYtdUnits) / lastYearYtdUnits) * 100 : 0;

  // For Blended Margin calculation, use Gross Profit / Revenue
  // Gross Profit = Revenue - COGS (from ytdTotalRevenue and ytdTotalCost calculated earlier)
  const ytdGrossProfit = ytdTotalRevenue - ytdTotalCost;
  const lastYearYtdGrossProfit = lastYearYtdTotalRevenue - lastYearYtdTotalCost;

  const ytdBlendedMargin = ytdTotalRevenue > 0
    ? (ytdGrossProfit / ytdTotalRevenue) * 100
    : 0;
  const lastYearYtdBlendedMargin = lastYearYtdTotalRevenue > 0
    ? (lastYearYtdGrossProfit / lastYearYtdTotalRevenue) * 100
    : 0;
  const marginChange = ytdBlendedMargin - lastYearYtdBlendedMargin; // Absolute difference in margin %

  // Calculate revenue change (using invoice-based revenue calculated above)
  const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;
  const unitsChange = lastMonthUnits > 0 ? ((currentMonthUnits - lastMonthUnits) / lastMonthUnits) * 100 : 0;
  const openOrdersChange = (openOrdersCount || 0) - (lastMonthOpenCount || 0);

  // Format currency
  const formatCurrency = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000000) {
      return `$${(dollars / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(dollars).toLocaleString('en-US')}`;
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
      value: formatCurrency(ytdNetRevenue),
      change: `${ytdNetRevenueChange >= 0 ? '+' : ''}${ytdNetRevenueChange.toFixed(1)}%`,
      trend: ytdNetRevenueChange >= 0 ? 'up' : 'down',
      icon: 'trending-up',
      color: 'bg-teal-500',
      subtitle: 'vs same period last year',
    },
    {
      id: 'units-sold',
      title: `Units Sold (${periodLabel})`,
      value: currentMonthUnits.toLocaleString('en-US'),
      change: `${unitsChange >= 0 ? '+' : ''}${unitsChange.toFixed(1)}%`,
      trend: unitsChange >= 0 ? 'up' : 'down',
      icon: 'package',
      color: 'bg-blue-500',
      subtitle: `38": ${currentMonthUnits38} | 24": ${currentMonthUnits24}`,
    },
    {
      id: 'units-sold-ytd',
      title: 'Units Sold (YTD)',
      value: ytdUnits.toLocaleString('en-US'),
      change: `${ytdUnitsChange >= 0 ? '+' : ''}${ytdUnitsChange.toFixed(1)}%`,
      trend: ytdUnitsChange >= 0 ? 'up' : 'down',
      icon: 'package',
      color: 'bg-indigo-500',
      subtitle: `38": ${ytdUnits38} | 24": ${ytdUnits24}`,
    },
    {
      id: 'blended-margin',
      title: 'Blended Margin (YTD)',
      // (YTD revenue − YTD cost at the order cycle's cost, else products.base_cost) ÷ YTD revenue, commission lines excluded
      value: ytdTotalRevenue > 0 ? `${ytdBlendedMargin.toFixed(1)}%` : '—',
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

  // Ankur's Definition 3.2 (same rule as the Executive tabs): gross margin of the
  // tire lines of firm orders delivered in the month (recognized-sales.service)
  let recognized;
  try {
    recognized = await loadRecognizedSales();
  } catch (error) {
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

  for (const line of recognized.lines) {
    if (!line.isTire || line.date < startDate || line.date > endDate) {
      continue;
    }
    const monthKey = line.date.slice(0, 7);
    if (!monthlyData[monthKey]) continue;

    const lineCost = line.cost ?? 0;
    monthlyData[monthKey].totalRevenue += line.lineTotal;
    monthlyData[monthKey].totalCost += lineCost;
    if (line.tireSize === '38') {
      monthlyData[monthKey].revenue38 += line.lineTotal;
      monthlyData[monthKey].cost38 += lineCost;
    } else if (line.tireSize === '24') {
      monthlyData[monthKey].revenue24 += line.lineTotal;
      monthlyData[monthKey].cost24 += lineCost;
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

  // Recognized tire revenue (Ankur 3.1, same rule as the Executive tabs):
  // tire lines of firm orders delivered in the month − credit notes in the month
  let recognized;
  try {
    recognized = await loadRecognizedSales();
  } catch (error) {
    console.error('Error fetching revenue trend:', error);
    recognized = { lines: [], credits: [] };
  }

  // Same date range one year earlier
  const startDateObj = new Date(queryStartDate);
  const endDateObj = new Date(queryEndDate);
  const lastYearStart = formatDateString(new Date(startDateObj.getFullYear() - 1, startDateObj.getMonth(), startDateObj.getDate()));
  const lastYearEnd = formatDateString(new Date(endDateObj.getFullYear() - 1, endDateObj.getMonth(), endDateObj.getDate()));

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

  const addTo = (target: Record<string, number>, date: string, cents: number) => {
    const monthKey = date.slice(5, 7);
    if (target[monthKey] !== undefined) {
      target[monthKey] += cents / 100; // cents to dollars
    }
  };
  const tireLines = recognized.lines.filter((l) => l.isTire);
  for (const line of tireLines) {
    if (line.date >= queryStartDate && line.date <= queryEndDate) addTo(monthlyRevenue, line.date, line.lineTotal);
    if (line.date >= lastYearStart && line.date <= lastYearEnd) addTo(lastYearRevenue, line.date, line.lineTotal);
  }
  for (const credit of recognized.credits) {
    if (credit.date >= queryStartDate && credit.date <= queryEndDate) addTo(monthlyRevenue, credit.date, -credit.amount);
    if (credit.date >= lastYearStart && credit.date <= lastYearEnd) addTo(lastYearRevenue, credit.date, -credit.amount);
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

/**
 * Get commission revenue statistics (YTD)
 * Tracks expected and actual commission revenue from service items
 * Commission items are identified by item_type='service' AND (sku or description contains 'commission')
 */
export async function getCommissionRevenue(): Promise<CommissionRevenueStats> {
  const supabase = createAdminClient();

  // Current year dates
  const now = new Date();
  const currentYearStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1); // Jan 1 of last year
  const lastYearSameDay = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // Same day last year

  // Query YTD commission items (all statuses for "expected")
  // Filter by order_date (when order was placed) instead of requested_delivery_date
  const { data: ytdCommissionItems, error: commError } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      unit_price,
      sku,
      description,
      products (
        item_type
      ),
      sales_orders!inner (
        status,
        deleted_at,
        order_date
      )
    `)
    .gte('sales_orders.order_date', formatDateString(currentYearStart))
    .is('sales_orders.deleted_at', null)
    .in('sales_orders.status', ['confirmed', 'processing', 'shipped', 'delivered']);

  // DEBUG: Log commission query
  console.log('💼 Commission Items Query (YTD):', {
    yearStart: formatDateString(currentYearStart),
    totalItems: ytdCommissionItems?.length || 0,
    error: commError,
  });

  // Query YTD delivered commission items (for "actual")
  const { data: ytdDeliveredCommissionItems } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      unit_price,
      sku,
      description,
      products (
        item_type
      ),
      sales_orders!inner (
        status,
        deleted_at,
        order_date
      )
    `)
    .gte('sales_orders.order_date', formatDateString(currentYearStart))
    .is('sales_orders.deleted_at', null)
    .eq('sales_orders.status', 'delivered');

  // Query last year YTD delivered commission items (for comparison)
  const { data: lastYearCommissionItems } = await supabase
    .from('sales_order_items')
    .select(`
      quantity,
      unit_price,
      sku,
      description,
      products (
        item_type
      ),
      sales_orders!inner (
        status,
        deleted_at,
        order_date
      )
    `)
    .gte('sales_orders.order_date', formatDateString(lastYearStart))
    .lte('sales_orders.order_date', formatDateString(lastYearSameDay))
    .is('sales_orders.deleted_at', null)
    .eq('sales_orders.status', 'delivered');

  // Helper function to check if item is a commission item
  const isCommissionItem = (item: {
    sku: string | null;
    description: string | null;
    products: unknown;
  }): boolean => {
    const product = item.products as { item_type: string | null } | null;

    // Must be a service item
    if (product?.item_type !== 'service') {
      return false;
    }

    // Check if sku or description contains "commission"
    const skuLower = (item.sku || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();

    return skuLower.includes('commission') || descLower.includes('commission');
  };

  // Calculate expected YTD (all open + delivered orders)
  let expectedYTD = 0;
  let expectedCommissionCount = 0;
  if (ytdCommissionItems) {
    for (const item of ytdCommissionItems) {
      if (isCommissionItem(item)) {
        expectedCommissionCount++;
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0; // in cents
        expectedYTD += (unitPrice * quantity) / 100; // convert to dollars
      }
    }
  }

  // Calculate actual YTD (delivered orders only)
  let actualYTD = 0;
  let actualCommissionCount = 0;
  if (ytdDeliveredCommissionItems) {
    for (const item of ytdDeliveredCommissionItems) {
      if (isCommissionItem(item)) {
        actualCommissionCount++;
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0; // in cents
        actualYTD += (unitPrice * quantity) / 100; // convert to dollars
      }
    }
  }

  // DEBUG: Log commission calculation results
  console.log('💼 Commission Calculation Results:', {
    expectedCommissionItemsFound: expectedCommissionCount,
    expectedYTD: `$${expectedYTD.toFixed(2)}`,
    actualCommissionItemsFound: actualCommissionCount,
    actualYTD: `$${actualYTD.toFixed(2)}`,
    sampleCommissionItems: ytdCommissionItems?.filter(isCommissionItem).slice(0, 3).map(i => ({
      sku: i.sku,
      description: i.description,
      itemType: (i.products as any)?.item_type,
    })),
  });

  // Calculate last year actual YTD (for comparison)
  let lastYearActualYTD = 0;
  if (lastYearCommissionItems) {
    for (const item of lastYearCommissionItems) {
      if (isCommissionItem(item)) {
        const quantity = item.quantity || 0;
        const unitPrice = item.unit_price || 0; // in cents
        lastYearActualYTD += (unitPrice * quantity) / 100; // convert to dollars
      }
    }
  }

  // Calculate change percentage
  const change = lastYearActualYTD > 0
    ? ((actualYTD - lastYearActualYTD) / lastYearActualYTD) * 100
    : 0;

  return {
    expectedYTD: Math.round(expectedYTD),
    actualYTD: Math.round(actualYTD),
    lastYearActualYTD: Math.round(lastYearActualYTD),
    change: Math.round(change * 10) / 10, // Round to 1 decimal
    trend: change >= 0 ? 'up' : 'down',
  };
}
