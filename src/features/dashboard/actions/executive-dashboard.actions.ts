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
import { buildTableDrillDown } from '../services/financial-drilldown.service';
import { TABLE_DRILLDOWNS, type CsvExport, type TableDrillDown } from '../lib/drilldown';
import {
  DASHBOARD_TAB_PERMISSIONS,
  EXECUTIVE_TABS,
  pickExecutiveTabs,
  tableDrillDownTab,
  type ExecutiveDashboardView,
} from '../lib/dashboard-tabs';

export async function getExecutiveDashboard(): Promise<
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
    await saveDailySnapshot(erp, inventoryAtCost).catch((error) => console.error('[ExecutiveDashboard] Daily snapshot failed:', error));
    const history = await loadDailyHistory(erp.asOf).catch((error) => {
      console.error('[ExecutiveDashboard] Daily history failed:', error);
      return [];
    });

    return { success: true, data: pickExecutiveTabs(buildExecutiveModel(erp, qbo, connected, history), tabs) };
  } catch (error) {
    console.error('[ExecutiveDashboard] Failed:', error);
    return { success: false, error: 'Failed to load the executive dashboard' };
  }
}

/**
 * CSV of the rows behind an executive table (download button next to its eye
 * icon). Needs the permission of the tab the table is on.
 */
export async function getTableDrillDownCsv(
  kind: TableDrillDown
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
    return { success: true, data: await buildTableDrillDown(kind) };
  } catch (error) {
    console.error('[ExecutiveDashboard] Export failed:', error);
    const message = error instanceof Error ? error.message : '';
    // Setup problems are shown as they are; anything else stays generic
    return { success: false, error: /QuickBooks|Sync now/.test(message) ? message : 'Failed to build the export' };
  }
}
