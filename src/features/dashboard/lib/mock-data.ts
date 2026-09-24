/**
 * Dashboard Mock Data
 *
 * Static data for dashboard components.
 * Replace with API calls when backend is ready.
 *
 * Note: Icons are stored as string names (not components)
 * to allow serialization between Server and Client Components.
 */

import type {
  DashboardStat,
  DashboardActivity,
  QuickAction,
  SystemStatus,
  RevenueDataPoint,
  UnitsBySKUDataPoint,
  ChannelPerformanceDataPoint,
  MarginDataPoint,
  ARAgingData,
  APSummaryData,
  NeedsAttentionItem,
  PipelineStage,
  InventoryByLocation,
  InventoryBySKU,
} from '../types';

// ============================================
// STATS DATA (Gesher-specific KPIs)
// ============================================

export const dashboardStats: DashboardStat[] = [
  {
    id: 'revenue-mtd',
    title: 'Revenue (MTD)',
    value: '$245,000',
    change: '+12.5%',
    trend: 'up',
    icon: 'dollar-sign',
    color: 'bg-emerald-500',
    target: '$220,000',
  },
  {
    id: 'units-sold',
    title: 'Units Sold (MTD)',
    value: '1,234',
    change: '+8.3%',
    trend: 'up',
    icon: 'package',
    color: 'bg-blue-500',
    subtitle: '38": 800 | 24": 434',
  },
  {
    id: 'blended-margin',
    title: 'Blended Margin',
    value: '32.5%',
    change: '+2.1%',
    trend: 'up',
    icon: 'percent',
    color: 'bg-violet-500',
    target: '30%',
  },
  {
    id: 'open-orders',
    title: 'Open Orders',
    value: '18',
    change: '-3',
    trend: 'down',
    icon: 'shopping-cart',
    color: 'bg-orange-500',
    subtitle: '$89,000 value',
  },
];

// ============================================
// REVENUE CHART DATA
// ============================================

export const revenueChartData: RevenueDataPoint[] = [
  { month: 'Jan', revenue: 185000, target: 180000, lastYear: 165000 },
  { month: 'Feb', revenue: 195000, target: 185000, lastYear: 172000 },
  { month: 'Mar', revenue: 220000, target: 200000, lastYear: 195000 },
  { month: 'Apr', revenue: 210000, target: 210000, lastYear: 188000 },
  { month: 'May', revenue: 235000, target: 215000, lastYear: 210000 },
  { month: 'Jun', revenue: 245000, target: 220000, lastYear: 218000 },
  { month: 'Jul', revenue: 260000, target: 230000, lastYear: 232000 },
  { month: 'Aug', revenue: 245000, target: 220000, lastYear: 215000 },
];

// ============================================
// UNITS BY SKU DATA
// ============================================

export const unitsBySKUData: UnitsBySKUDataPoint[] = [
  { name: 'Jan', units38: 520, units24: 280 },
  { name: 'Feb', units38: 580, units24: 320 },
  { name: 'Mar', units38: 650, units24: 380 },
  { name: 'Apr', units38: 600, units24: 350 },
  { name: 'May', units38: 720, units24: 420 },
  { name: 'Jun', units38: 800, units24: 434 },
];

// ============================================
// CHANNEL PERFORMANCE DATA
// ============================================

export const channelPerformanceData: ChannelPerformanceDataPoint[] = [
  { channel: 'OEM', revenue: 156000, units: 780, fill: '#3b82f6' },
  { channel: 'Dealer', revenue: 89000, units: 454, fill: '#10b981' },
];

// ============================================
// MARGIN DATA
// ============================================

export const marginChartData: MarginDataPoint[] = [
  { month: 'Jan', margin: 28.5, target: 30, sku38Margin: 30.2, sku24Margin: 26.1 },
  { month: 'Feb', margin: 29.2, target: 30, sku38Margin: 31.0, sku24Margin: 26.8 },
  { month: 'Mar', margin: 30.8, target: 30, sku38Margin: 32.5, sku24Margin: 28.2 },
  { month: 'Apr', margin: 29.5, target: 30, sku38Margin: 31.2, sku24Margin: 27.0 },
  { month: 'May', margin: 31.2, target: 30, sku38Margin: 33.0, sku24Margin: 28.5 },
  { month: 'Jun', margin: 32.5, target: 30, sku38Margin: 34.2, sku24Margin: 29.8 },
];

// ============================================
// AR AGING DATA
// ============================================

export const arAgingData: ARAgingData = {
  current: 50000,
  days30: 25000,
  days60: 10000,
  days90Plus: 5000,
};

// ============================================
// AP SUMMARY DATA
// ============================================

export const apSummaryData: APSummaryData = {
  totalOutstanding: 125000,
  dueThisWeek: 45000,
  dueNextWeek: 80000,
  supplierName: 'Galileo (Alon)',
};

// ============================================
// NEEDS ATTENTION DATA
// ============================================

export const needsAttentionItems: NeedsAttentionItem[] = [
  {
    id: '1',
    category: 'credit_hold',
    title: 'Credit Hold',
    description: 'Orders awaiting Ankur/Andy approval',
    count: 3,
    priority: 'high',
    assignee: 'Ankur',
    href: '/sales-orders?status=credit_hold',
  },
  {
    id: '2',
    category: 'price_approval',
    title: 'Price Approval',
    description: 'Quotes with off-matrix pricing',
    count: 2,
    priority: 'medium',
    assignee: 'Andy',
    href: '/quotes?needs_approval=price',
  },
  {
    id: '3',
    category: 'quote_approval',
    title: 'Quote Approval',
    description: 'Pending finance approval',
    count: 4,
    priority: 'medium',
    assignee: 'Ankur',
    href: '/quotes?status=pending_approval',
  },
  {
    id: '4',
    category: 'stock_contention',
    title: 'Stock Contention',
    description: 'Allocation conflict',
    count: 1,
    priority: 'high',
    assignee: 'Jenny',
    href: '/inventory?contention=true',
  },
  {
    id: '5',
    category: 'low_inventory',
    title: 'Low Inventory',
    description: '24" tire below reorder point (Nebraska)',
    count: 1,
    priority: 'medium',
    href: '/inventory?alert=low',
  },
  {
    id: '6',
    category: 'shipment_today',
    title: 'Shipments Today',
    description: 'Deliveries expected',
    count: 3,
    priority: 'low',
    href: '/shipments?date=today',
  },
  {
    id: '7',
    category: 'sync_failed',
    title: 'QBO Sync Failed',
    description: 'Invoices failed to push',
    count: 2,
    priority: 'high',
    href: '/sync?status=failed',
  },
  {
    id: '8',
    category: 'past_due_ar',
    title: 'Past Due AR',
    description: 'Customers > 60 days',
    count: 2,
    priority: 'medium',
    href: '/customers?ar_status=past_due',
  },
];

// ============================================
// ORDER PIPELINE DATA
// ============================================

export const orderPipelineData: PipelineStage[] = [
  { id: 'quotes', name: 'Quotes', count: 12, value: 156000, status: 'active' },
  { id: 'sales-orders', name: 'Sales Orders', count: 8, value: 234000, status: 'active' },
  { id: 'purchase-orders', name: 'POs', count: 5, value: 180000, status: 'active' },
  { id: 'shipments', name: 'In Transit', count: 3, value: 95000, status: 'pending' },
];

// ============================================
// INVENTORY DATA
// ============================================

export const inventoryByLocation: InventoryByLocation[] = [
  { location: 'Nebraska', onHand: 450, allocated: 120, available: 330, inTransit: 200, daysOfCover: 45 },
  { location: 'Kansas', onHand: 280, allocated: 80, available: 200, inTransit: 150, daysOfCover: 38 },
  { location: 'Drop-ship', onHand: 0, allocated: 50, available: 0, inTransit: 100, daysOfCover: 0 },
];

export const inventoryBySKU: InventoryBySKU[] = [
  { sku: '38-TIRE', name: '38" Irrigation Pivot Tire', total: 480, allocated: 150, available: 330 },
  { sku: '24-TIRE', name: '24" Irrigation Pivot Tire', total: 250, allocated: 100, available: 150 },
];

// ============================================
// ACTIVITY DATA
// ============================================

export const recentActivities: DashboardActivity[] = [
  {
    id: '1',
    title: 'Quote #Q-1234 approved',
    description: 'Approved by Ankur',
    time: '2 min ago',
    status: 'success',
  },
  {
    id: '2',
    title: 'Invoice #INV-567 synced to QuickBooks',
    description: '$12,450 pushed successfully',
    time: '15 min ago',
    status: 'success',
  },
  {
    id: '3',
    title: 'SO #SO-890 converted from Quote',
    description: 'Quote #Q-1230 → Sales Order',
    time: '30 min ago',
    status: 'info',
  },
  {
    id: '4',
    title: 'Credit hold placed',
    description: 'Valley Farms - over credit limit',
    time: '1 hour ago',
    status: 'warning',
  },
  {
    id: '5',
    title: 'Shipment #SH-456 delivered',
    description: 'Midwest Pivots received 24 units',
    time: '2 hours ago',
    status: 'success',
  },
  {
    id: '6',
    title: 'PO #PO-123 status update',
    description: 'On Water, ETA Dec 15',
    time: '3 hours ago',
    status: 'info',
  },
];

// ============================================
// QUICK ACTIONS DATA
// ============================================

export const quickActions: QuickAction[] = [
  {
    id: 'new-quote',
    label: 'New Quote',
    href: '/quotes/new',
    icon: 'file-text',
  },
  {
    id: 'new-order',
    label: 'New Order',
    href: '/sales-orders/new',
    icon: 'shopping-cart',
  },
  {
    id: 'add-customer',
    label: 'Add Customer',
    href: '/customers/new',
    icon: 'users',
  },
  {
    id: 'view-shipments',
    label: 'Shipments',
    href: '/shipments',
    icon: 'truck',
  },
];

// ============================================
// SYSTEM STATUS DATA
// ============================================

export const systemStatus: SystemStatus = {
  items: [
    {
      id: 'qbo',
      name: 'QuickBooks Online',
      status: 'operational',
    },
    {
      id: 'database',
      name: 'Database',
      status: 'operational',
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      status: 'operational',
    },
  ],
  lastSync: '2 min ago',
};
