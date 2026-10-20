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
import { buildExecutiveModel, type ExecutiveDashboardModel } from '../lib/executive-model';

export async function getExecutiveDashboard(): Promise<
  { success: true; data: ExecutiveDashboardModel } | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, 'dashboard.view_module')) {
    return { success: false, error: 'Permission denied: dashboard.view_module' };
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

    return { success: true, data: buildExecutiveModel(erp, qbo, connected, history) };
  } catch (error) {
    console.error('[ExecutiveDashboard] Failed:', error);
    return { success: false, error: 'Failed to load the executive dashboard' };
  }
}
