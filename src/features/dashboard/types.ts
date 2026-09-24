/**
 * Dashboard Types
 *
 * Type definitions for dashboard components and data.
 * Note: Icons are stored as string names to allow serialization
 * between Server and Client Components.
 */

// ============================================
// DATE RANGE FILTER TYPES
// ============================================

export type DateRangePreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'ytd'
  | 'last_year'
  | 'last_6_months'
  | 'last_12_months'
  | 'custom';

export interface DateRange {
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
  preset?: DateRangePreset;
}

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  last_quarter: 'Last Quarter',
  ytd: 'Year to Date',
  last_year: 'Last Year',
  last_6_months: 'Last 6 Months',
  last_12_months: 'Last 12 Months',
  custom: 'Custom Date',
};

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate date range from preset
 */
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);

  let startDate: Date;
  let endDate: Date = now;

  switch (preset) {
    case 'this_month':
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case 'last_month':
      startDate = new Date(currentYear, currentMonth - 1, 1);
      endDate = new Date(currentYear, currentMonth, 0); // Last day of previous month
      break;
    case 'this_quarter':
      startDate = new Date(currentYear, currentQuarter * 3, 1);
      break;
    case 'last_quarter':
      startDate = new Date(currentYear, (currentQuarter - 1) * 3, 1);
      endDate = new Date(currentYear, currentQuarter * 3, 0); // Last day of previous quarter
      break;
    case 'ytd':
      startDate = new Date(currentYear, 0, 1);
      break;
    case 'last_year':
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear - 1, 11, 31);
      break;
    case 'last_6_months':
      // Properly calculate 6 months ago from today
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case 'last_12_months':
      // Calculate exactly 12 months ago from today
      startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      break;
    case 'custom':
      // For custom, default to this month - actual dates set by picker
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    default:
      startDate = new Date(currentYear, currentMonth, 1);
  }

  return {
    startDate: formatDateToString(startDate),
    endDate: formatDateToString(endDate),
    preset,
  };
}

// ============================================
// ICON TYPES
// ============================================

export type DashboardIconName =
  | 'package'
  | 'users'
  | 'trending-up'
  | 'dollar-sign'
  | 'shopping-cart'
  | 'file-text'
  | 'truck'
  | 'bar-chart'
  | 'percent'
  | 'alert-triangle'
  | 'credit-card'
  | 'warehouse'
  | 'target'
  | 'clock';

// ============================================
// STATS TYPES
// ============================================

export interface DashboardStat {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: DashboardIconName;
  color: string;
  subtitle?: string; // For additional info like "38": 800, 24": 434"
  target?: string; // For target comparison
}

// ============================================
// ACTIVITY TYPES
// ============================================

export type ActivityStatus = 'success' | 'warning' | 'info' | 'error';

export interface DashboardActivity {
  id: string;
  title: string;
  description: string;
  time: string;
  status: ActivityStatus;
}

// ============================================
// QUICK ACTION TYPES
// ============================================

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon?: DashboardIconName;
}

// ============================================
// SYSTEM STATUS TYPES
// ============================================

export type SystemHealthStatus = 'operational' | 'degraded' | 'down';

export interface SystemStatusItem {
  id: string;
  name: string;
  status: SystemHealthStatus;
  message?: string;
}

export interface SystemStatus {
  items: SystemStatusItem[];
  lastSync: string;
}

// ============================================
// CHART DATA TYPES
// ============================================

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  target: number;
  lastYear?: number;
}

export interface UnitsBySKUDataPoint {
  name: string;
  [key: string]: string | number; // Dynamic product keys (e.g., units_PRODUCT_SKU)
}

export interface ProductLegendItem {
  key: string;
  label: string;
  color: string;
}

export interface UnitsBySKUChartData {
  data: UnitsBySKUDataPoint[];
  products: ProductLegendItem[];
}

export interface ChannelPerformanceDataPoint {
  channel: string;
  revenue: number;
  units: number;
  fill: string;
}

export interface MarginDataPoint {
  month: string;
  margin: number;
  target: number;
  sku38Margin?: number;
  sku24Margin?: number;
}

// ============================================
// AR/AP TYPES
// ============================================

export interface ARAgingData {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

export interface APSummaryData {
  totalOutstanding: number;
  dueThisWeek: number;
  dueNextWeek: number;
  supplierName: string;
}

// ============================================
// NEEDS ATTENTION TYPES
// ============================================

export type AttentionPriority = 'high' | 'medium' | 'low';
export type AttentionCategory =
  | 'credit_hold'
  | 'price_approval'
  | 'quote_approval'
  | 'stock_contention'
  | 'low_inventory'
  | 'shipment_today'
  | 'sync_failed'
  | 'past_due_ar';

export interface NeedsAttentionItem {
  id: string;
  category: AttentionCategory;
  title: string;
  description: string;
  count: number;
  priority: AttentionPriority;
  assignee?: string;
  href?: string;
}

// ============================================
// ORDER PIPELINE TYPES
// ============================================

export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  status: 'active' | 'completed' | 'pending';
}

// ============================================
// INVENTORY OVERVIEW TYPES
// ============================================

export interface InventoryByLocation {
  location: string;
  onHand: number;
  allocated: number;
  available: number;
  inTransit: number;
  daysOfCover: number;
}

export interface InventoryBySKU {
  sku: string;
  name: string;
  total: number;
  allocated: number;
  available: number;
}
