/**
 * Dashboard tabs and the permission behind each one (migration 170), and the
 * Overview tab's sections, each with its own permission (migration 171).
 *
 * The three executive tabs share one data request; the server sends only the
 * sections of the tabs the user may see.
 */

import type { ExecutiveDashboardModel } from './executive-model';
import type { OverviewDrillDown, TableDrillDown } from './drilldown';

export const DASHBOARD_TAB_PERMISSIONS = {
  financial: 'dashboard.view_financial_metrics_tab',
  profitability: 'dashboard.view_profitability_tab',
  supply: 'dashboard.view_supply_chain_tab',
  overview: 'dashboard.view_overview_tab',
} as const;

export type DashboardTab = keyof typeof DASHBOARD_TAB_PERMISSIONS;
export type ExecutiveTab = Exclude<DashboardTab, 'overview'>;

/** Display order of the tabs */
export const DASHBOARD_TABS: DashboardTab[] = ['financial', 'profitability', 'supply', 'overview'];
export const EXECUTIVE_TABS: ExecutiveTab[] = ['financial', 'profitability', 'supply'];

export const EXECUTIVE_TAB_PERMISSIONS = EXECUTIVE_TABS.map((tab) => DASHBOARD_TAB_PERMISSIONS[tab]);

type SharedKey = 'asOf' | 'quickBooks';
type SectionKey = Exclude<keyof ExecutiveDashboardModel, SharedKey>;

/** Executive model sections shown on each tab */
export const EXECUTIVE_TAB_SECTIONS: Record<ExecutiveTab, SectionKey[]> = {
  financial: ['liquidity', 'workingCapital', 'efficiency', 'efficiencyInputs', 'cashGeneration'],
  profitability: ['profitability', 'perTire', 'opexRunRate', 'backlog', 'commission'],
  supply: ['supply', 'inventory'],
};

/** What the server sends: only the sections of the allowed tabs */
export type ExecutiveDashboardView = Pick<ExecutiveDashboardModel, SharedKey> & Partial<Pick<ExecutiveDashboardModel, SectionKey>>;

/** Tabs the user may open, in display order */
export function allowedDashboardTabs(can: (permission: string) => boolean): DashboardTab[] {
  return DASHBOARD_TABS.filter((tab) => can(DASHBOARD_TAB_PERMISSIONS[tab]));
}

export function pickExecutiveTabs(model: ExecutiveDashboardModel, tabs: ExecutiveTab[]): ExecutiveDashboardView {
  const view: ExecutiveDashboardView = { asOf: model.asOf, quickBooks: model.quickBooks };
  for (const tab of tabs) {
    for (const key of EXECUTIVE_TAB_SECTIONS[tab]) {
      Object.assign(view, { [key]: model[key] });
    }
  }
  return view;
}

/** The model for one tab, or null when its sections were not sent */
export function executiveTabModel(view: ExecutiveDashboardView, tab: ExecutiveTab): ExecutiveDashboardModel | null {
  return EXECUTIVE_TAB_SECTIONS[tab].every((key) => view[key] !== undefined) ? (view as ExecutiveDashboardModel) : null;
}

/** Tab of an executive table export: 1.x Financial Metrics, 2.x and 3.x Profitability, 4.x Supply Chain */
export function tableDrillDownTab(kind: TableDrillDown): ExecutiveTab {
  if (kind.startsWith('table-1.')) {
    return 'financial';
  }
  if (kind.startsWith('table-4.')) {
    return 'supply';
  }
  return 'profitability';
}

// ============================================
// OVERVIEW TAB SECTIONS
// ============================================

export const OVERVIEW_SECTION_PERMISSIONS = {
  kpis: 'dashboard.view_overview_kpis',
  revenueTrend: 'dashboard.view_revenue_trend_chart',
  unitsBySku: 'dashboard.view_units_by_sku_chart',
  channel: 'dashboard.view_channel_performance_chart',
  margin: 'dashboard.view_margin_analysis_chart',
  inventory: 'dashboard.view_inventory_overview',
} as const;

export type OverviewSection = keyof typeof OVERVIEW_SECTION_PERMISSIONS;

/** Display order on the Overview tab */
export const OVERVIEW_SECTIONS: OverviewSection[] = ['kpis', 'revenueTrend', 'unitsBySku', 'channel', 'margin', 'inventory'];

/** Overview sections the user may see: needs the Overview tab and the section's own permission */
export function allowedOverviewSections(can: (permission: string) => boolean): OverviewSection[] {
  if (!can(DASHBOARD_TAB_PERMISSIONS.overview)) {
    return [];
  }
  return OVERVIEW_SECTIONS.filter((section) => can(OVERVIEW_SECTION_PERMISSIONS[section]));
}

/** Section of an Overview export: KPI cards, else the chart it belongs to */
export function overviewDrillDownSection(kind: OverviewDrillDown): OverviewSection {
  switch (kind) {
    case 'revenue-trend':
      return 'revenueTrend';
    case 'units-by-sku':
      return 'unitsBySku';
    case 'channel':
      return 'channel';
    case 'margin-analysis':
      return 'margin';
    default:
      return 'kpis';
  }
}
