'use server';

/**
 * Executive dashboard (Ankur's spec, 11 tables) — data for the Financial
 * Metrics, Profitability and Supply Chain tabs. ERP figures are computed on
 * request; QuickBooks figures come from the latest stored snapshot (daily
 * sync / "Sync now"). Today's backlog and inventory are recorded for the
 * T90 / YTD averages (migration 163).
 */

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { getConnectionByProvider } from '@/modules/integrations/core';
import { getLatestSnapshot } from '@/modules/integrations/quickbooks/services/qbo-financials.service';
import { buildErpExecutiveFigures } from '../services/executive-erp.service';
import { loadDailyHistory, saveDailySnapshot } from '../services/executive-history.service';
import { buildExecutiveModel } from '../lib/executive-model';
import { availableBases, isPnlBasis, withPnlBasis, type PnlBasis } from '../lib/pnl-basis';
import { buildTableDrillDown } from '../services/financial-drilldown.service';
import { TABLE_DRILLDOWNS, type CsvExport, type TableDrillDown } from '../lib/drilldown';
import {
  DASHBOARD_TAB_PERMISSIONS,
  EXECUTIVE_TABS,
  pickExecutiveTabs,
  tableDrillDownTab,
  type ExecutiveDashboardView,
} from '../lib/dashboard-tabs';

// export async function getExecutiveDashboard(): Promise<
// Nov 12 2026: basis = Cash / Accrual toggle (anything else = Cash)
export async function getExecutiveDashboard(basis?: PnlBasis): Promise<
  { success: true; data: ExecutiveDashboardView } | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  // Only the sections of the tabs this user may open
  const tabs = EXECUTIVE_TABS.filter((tab) => hasPermission(user, DASHBOARD_TAB_PERMISSIONS[tab]));
  if (tabs.length === 0) {
    return { success: false, error: 'Permission denied: dashboard tabs' };
  }

  try {
    const erp = await buildErpExecutiveFigures();

    const connection = await getConnectionByProvider('quickbooks');
    const connected = Boolean(connection && connection.status === 'connected' && connection.external_account_id);
    const snapshot = connected ? await getLatestSnapshot(connection!.external_account_id!) : { financials: null };

    // Record today's backlog/inventory for the averages; never blocks the dashboard
    const qbo = snapshot.financials;
    const inventoryAtCost = qbo && qbo.asOf === erp.asOf ? qbo.inventory : null;
    // Nov 7 2026: backlog history from the QuickBooks open sales orders when the snapshot has them
    const qso = qbo?.periods?.openSalesOrders;
    await saveDailySnapshot(erp, inventoryAtCost, qso ? { tires: qso.tires, revenue: qso.total } : null).catch((error) =>
      console.error('[ExecutiveDashboard] Daily snapshot failed:', error)
    );
    const history = await loadDailyHistory(erp.asOf).catch((error) => {
      console.error('[ExecutiveDashboard] Daily history failed:', error);
      return [];
    });

    // return { success: true, data: pickExecutiveTabs(buildExecutiveModel(erp, qbo, connected, history), tabs) };
    // The daily snapshot above keeps the stored figures; only the P&L shown follows the toggle
    const shown = qbo ? withPnlBasis(qbo, isPnlBasis(basis) ? basis : 'Cash') : null;
    return { success: true, data: pickExecutiveTabs(buildExecutiveModel(erp, shown?.financials ?? null, connected, history), tabs) };
  } catch (error) {
    console.error('[ExecutiveDashboard] Failed:', error);
    return { success: false, error: 'Failed to load the executive dashboard' };
  }
}

/**
 * Nov 12 2026: which P&L bases the latest QuickBooks snapshot can show, for the
 * Cash / Accrual toggle (Accrual figures arrive with the first sync after Nov 12 2026).
 */
export async function getPnlBasisOptions(): Promise<
  { success: true; data: { connected: boolean; available: Record<PnlBasis, boolean> } } | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  try {
    const connection = await getConnectionByProvider('quickbooks');
    const connected = Boolean(connection && connection.status === 'connected' && connection.external_account_id);
    const snapshot = connected ? await getLatestSnapshot(connection!.external_account_id!) : { financials: null };
    return { success: true, data: { connected, available: availableBases(snapshot.financials) } };
  } catch (error) {
    console.error('[ExecutiveDashboard] Basis options failed:', error);
    return { success: false, error: 'Failed to load the QuickBooks snapshot' };
  }
}

/**
 * CSV of the rows behind an executive table (download button next to its eye
 * icon). Needs the permission of the tab the table is on.
 */
export async function getTableDrillDownCsv(
  kind: TableDrillDown,
  // Nov 12 2026: Cash / Accrual toggle (anything else = Cash)
  basis?: PnlBasis
): Promise<{ success: true; data: CsvExport } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!TABLE_DRILLDOWNS.includes(kind)) {
    return { success: false, error: 'Unknown export' };
  }
  const permission = DASHBOARD_TAB_PERMISSIONS[tableDrillDownTab(kind)];
  if (!hasPermission(user, permission)) {
    return { success: false, error: `Permission denied: ${permission}` };
  }

  try {
    // return { success: true, data: await buildTableDrillDown(kind) };
    return { success: true, data: await buildTableDrillDown(kind, isPnlBasis(basis) ? basis : 'Cash') };
  } catch (error) {
    console.error('[ExecutiveDashboard] Export failed:', error);
    const message = error instanceof Error ? error.message : '';
    // Setup problems are shown as they are; anything else stays generic
    return { success: false, error: /QuickBooks|Sync now/.test(message) ? message : 'Failed to build the export' };
  }
}
