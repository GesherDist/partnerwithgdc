/**
 * GDC Pipedrive setup.
 *
 * Idempotently ensures the Pipedrive account matches the GDC spec:
 * - one "GDC Sales" pipeline with the six stages
 * - custom fields (Account Type, ERP Customer ID, Role, ERP Quote #, ...)
 * - activity types (Call, Site visit, Meeting, Quote follow-up, ...)
 *
 * Existing records are matched by name and reused. Nothing is renamed,
 * reordered or deleted; differences are reported for an admin to fix.
 * Settings Pipedrive exposes no API for (lost reasons, activity outcome
 * values and required fields, calendar sync) are returned as manual steps.
 */

import { db } from '@/shared/lib/supabase/database';
import { fetchAllRows } from '@/shared/lib/supabase/paginate';
import { pipedriveProvider, isPipedriveApiError } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import { classifyTireSize } from './purchase-history.service';
import {
  GDC_ACTIVITY_TYPES,
  GDC_CUSTOM_FIELDS,
  GDC_LOST_REASONS,
  GDC_PIPELINE_NAME,
  GDC_STAGES,
  type GdcActivityTypeKey,
  type GdcFieldEntity,
  type GdcFieldKey,
  type GdcStageKey,
} from './config';
import {
  getActivePipedriveConnectionId,
  getGrantedScopes,
  loadGdcConfig,
  saveGdcConfig,
  type GdcFieldMapping,
  type GdcResolvedConfig,
} from './settings';

// ============================================
// TYPES
// ============================================

export type SetupAction = 'existing' | 'created' | 'would_create' | 'conflict' | 'warning';

export interface SetupStep {
  entity: 'permission' | 'pipeline' | 'stage' | 'field' | 'field_option' | 'activity_type' | 'product';
  name: string;
  action: SetupAction;
  detail?: string;
}

export interface SetupReport {
  /** True when every required record exists (after this run) */
  ready: boolean;
  dryRun: boolean;
  steps: SetupStep[];
  manualSteps: string[];
  config: GdcResolvedConfig | null;
}

interface PipelineRecord {
  id: number;
  name: string;
}

interface StageRecord {
  id: number;
  name: string;
  orderNr: number;
}

interface FieldRecord {
  code: string;
  name: string;
  options: Array<{ id: number; label: string }>;
}

interface ActivityTypeRecord {
  name: string;
  keyString: string;
  active: boolean;
}

const FIELD_ENDPOINTS: Record<GdcFieldEntity, string> = {
  organization: 'organizationFields',
  person: 'personFields',
  deal: 'dealFields',
};

export const GDC_MANUAL_STEPS = [
  `Lost reasons: Company settings > Lost reasons. Add exactly ${GDC_LOST_REASONS.map((r) => `"${r}"`).join(', ')} and turn off "Allow free-form reasons" so one of them is required.`,
  `Call / site-visit reports: reps write the report in the activity note as "Outcome: Connected | Voicemail | No answer", "Summary: ...", "Next step: ..." (or schedule a next activity). Gesher checks every completed Call and Site visit and adds one reminder task when something is missing. Optional, if your Pipedrive plan offers required activity fields: also make the note required before an activity can be marked done.`,
  'Next steps: in Personal preferences, keep "Schedule a follow-up activity" prompts on for reps so a next activity is scheduled when one is completed.',
  'Google Calendar: each rep connects their own Google account under Personal preferences > Calendar sync and chooses two-way sync.',
  'Email timeline: each rep connects email sync (plan-dependent) so emails appear on the organization timeline.',
  'Webhooks: register the Gesher webhook URL with HTTP Basic Auth (PIPEDRIVE_WEBHOOK_USERNAME / PIPEDRIVE_WEBHOOK_PASSWORD) for deal, person, note and activity events.',
  'Reports: Insights can chart "Activities completed by type per user per month" and "Won deal value per user per month" natively; the Gesher rep report covers "new leads contacted" and tire counts.',
] as const;

// ============================================
// HELPERS
// ============================================

/**
 * Name comparison for existing Pipedrive records: case-insensitive, any dash
 * (hyphen, en/em dash) treated alike, spacing around "-" and "/" and repeated
 * spaces ignored. "Won - Order Placed" and "Lead/Prospect" therefore match the
 * spec names and are reused instead of duplicated.
 */
export const normalize = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212-]/g, '-')
    .replace(/\s*([-/])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function parsePipeline(raw: unknown): PipelineRecord | null {
  const r = raw as Record<string, unknown>;
  const id = toNumber(r?.id);
  if (id === null || r?.is_deleted === true) {return null;}
  return { id, name: String(r.name ?? '') };
}

function parseStage(raw: unknown): StageRecord | null {
  const r = raw as Record<string, unknown>;
  const id = toNumber(r?.id);
  if (id === null || r?.is_deleted === true) {return null;}
  return { id, name: String(r.name ?? ''), orderNr: toNumber(r.order_nr) ?? 0 };
}

function parseOption(raw: unknown): { id: number; label: string } | null {
  const o = raw as Record<string, unknown>;
  const id = toNumber(o?.id);
  return id === null ? null : { id, label: String(o.label ?? '') };
}

function parseField(raw: unknown): FieldRecord | null {
  const r = raw as Record<string, unknown>;
  // v2 uses field_code / field_name (v1 used key / name)
  const code = r?.field_code ?? r?.key;
  if (typeof code !== 'string' || !code) {return null;}
  return {
    code,
    name: String(r.field_name ?? r.name ?? ''),
    options: asArray(r.options)
      .map(parseOption)
      .filter((o): o is { id: number; label: string } => o !== null),
  };
}

function parseActivityType(raw: unknown): ActivityTypeRecord | null {
  const r = raw as Record<string, unknown>;
  if (typeof r?.key_string !== 'string') {return null;}
  return {
    name: String(r.name ?? ''),
    keyString: r.key_string,
    active: r.active_flag !== false && r.is_active !== false,
  };
}

// ============================================
// SETUP
// ============================================

export async function ensureGdcSetup(
  options: { dryRun?: boolean; connectionId?: string; skipProducts?: boolean } = {}
): Promise<SetupReport> {
  const dryRun = options.dryRun ?? false;
  const connectionId = options.connectionId ?? (await getActivePipedriveConnectionId());
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }

  const steps: SetupStep[] = [];
  let ready = true;

  // ---------- Permissions (granted OAuth scopes) ----------
  // Writing pipelines, stages, fields and activity types needs the 'admin'
  // scope (set on the app in Pipedrive Developer Hub) and a company admin.
  const scopes = await getGrantedScopes(connectionId);
  const missingAdmin = scopes !== null && !scopes.includes('admin');
  const canWriteProducts = scopes === null || scopes.includes('products:full');
  if (scopes === null) {
    steps.push({
      entity: 'permission',
      name: 'Pipedrive app scopes',
      action: 'warning',
      detail: 'not recorded for this connection; disconnect and reconnect Pipedrive to check them before applying',
    });
  } else {
    steps.push(
      missingAdmin
        ? { entity: 'permission', name: 'admin scope', action: 'conflict', detail: missingScopeDetail('admin') }
        : { entity: 'permission', name: 'admin scope', action: 'existing' }
    );
    if (!canWriteProducts) {
      steps.push({ entity: 'permission', name: 'products:full scope', action: 'warning', detail: missingScopeDetail('products:full') });
    }
  }
  if (missingAdmin && !dryRun) {
    // Nothing is written: a partial setup would be harder to fix than none
    return { ready: false, dryRun, steps, manualSteps: [...GDC_MANUAL_STEPS], config: null };
  }

  // ---------- Pipeline ----------
  const pipelines = (await pipedriveProvider.fetchAllV2<unknown>(connectionId, 'pipelines', undefined, runPipedriveRequest))
    .items.map(parsePipeline)
    .filter((p): p is PipelineRecord => p !== null);
  const matchingPipelines = pipelines.filter((p) => normalize(p.name) === normalize(GDC_PIPELINE_NAME));

  let pipelineId: number | null = null;
  if (matchingPipelines.length > 1) {
    steps.push({
      entity: 'pipeline',
      name: GDC_PIPELINE_NAME,
      action: 'conflict',
      detail: `${matchingPipelines.length} pipelines are named "${GDC_PIPELINE_NAME}"; merge or rename them so exactly one remains`,
    });
    ready = false;
  } else if (matchingPipelines.length === 1) {
    pipelineId = matchingPipelines[0]!.id;
    steps.push({ entity: 'pipeline', name: GDC_PIPELINE_NAME, action: 'existing' });
  } else if (dryRun) {
    steps.push({ entity: 'pipeline', name: GDC_PIPELINE_NAME, action: 'would_create' });
    ready = false;
  } else {
    const created = await runPipedriveWrite(() =>
      pipedriveProvider.request<unknown>(connectionId, 'POST', 'pipelines', { name: GDC_PIPELINE_NAME })
    );
    pipelineId = parsePipeline(created.data)?.id ?? null;
    if (pipelineId === null) {throw new Error('Pipedrive did not return the created pipeline');}
    steps.push({ entity: 'pipeline', name: GDC_PIPELINE_NAME, action: 'created' });
  }

  // ---------- Stages ----------
  const stageIds: Partial<Record<GdcStageKey, number>> = {};
  if (pipelineId !== null) {
    const params = new URLSearchParams({ pipeline_id: String(pipelineId) });
    const existingStages = (await pipedriveProvider.fetchAllV2<unknown>(connectionId, 'stages', params, runPipedriveRequest))
      .items.map(parseStage)
      .filter((s): s is StageRecord => s !== null)
      .sort((a, b) => a.orderNr - b.orderNr);

    for (const stage of GDC_STAGES) {
      const matches = existingStages.filter((s) => normalize(s.name) === normalize(stage.name));
      if (matches.length > 1) {
        steps.push({ entity: 'stage', name: stage.name, action: 'conflict', detail: 'duplicate stage names' });
        ready = false;
      } else if (matches.length === 1) {
        stageIds[stage.key] = matches[0]!.id;
        const existingName = matches[0]!.name.trim();
        steps.push(
          existingName === stage.name
            ? { entity: 'stage', name: stage.name, action: 'existing' }
            : {
                entity: 'stage',
                name: stage.name,
                action: 'existing',
                detail: `reused existing stage "${existingName}" (not renamed; rename it in Pipedrive to match exactly if you want)`,
              }
        );
      } else if (dryRun) {
        steps.push({ entity: 'stage', name: stage.name, action: 'would_create' });
        ready = false;
      } else {
        // New stages are appended, so creating them in spec order keeps the order
        const created = await runPipedriveWrite(() =>
          pipedriveProvider.request<unknown>(connectionId, 'POST', 'stages', {
            name: stage.name,
            pipeline_id: pipelineId,
          })
        );
        const createdStage = parseStage(created.data);
        if (!createdStage) {throw new Error(`Pipedrive did not return the created stage "${stage.name}"`);}
        stageIds[stage.key] = createdStage.id;
        existingStages.push({ ...createdStage, orderNr: Number.MAX_SAFE_INTEGER });
        steps.push({ entity: 'stage', name: stage.name, action: 'created' });
      }
    }

    // Report (never fix) extra stages and order differences
    const specNames = new Set(GDC_STAGES.map((s) => normalize(s.name)));
    for (const extra of existingStages.filter((s) => !specNames.has(normalize(s.name)))) {
      steps.push({
        entity: 'stage',
        name: extra.name,
        action: 'warning',
        detail: 'stage is not in the GDC spec; move its deals and delete it in Pipedrive if unused',
      });
    }
    const specOrder = existingStages
      .filter((s) => specNames.has(normalize(s.name)))
      .map((s) => normalize(s.name));
    const expectedOrder = GDC_STAGES.map((s) => normalize(s.name)).filter((n) => specOrder.includes(n));
    if (specOrder.join('|') !== expectedOrder.join('|')) {
      steps.push({
        entity: 'stage',
        name: GDC_PIPELINE_NAME,
        action: 'warning',
        detail: 'stages are not in the spec order; reorder them in Pipedrive (drag and drop)',
      });
    }
  }

  // ---------- Custom fields ----------
  const fields: Partial<Record<GdcFieldKey, GdcFieldMapping>> = {};
  const fieldCache = new Map<GdcFieldEntity, FieldRecord[]>();
  for (const definition of GDC_CUSTOM_FIELDS) {
    const endpoint = FIELD_ENDPOINTS[definition.entity];
    if (!fieldCache.has(definition.entity)) {
      const list = await pipedriveProvider.fetchAllV2<unknown>(connectionId, endpoint, undefined, runPipedriveRequest);
      fieldCache.set(
        definition.entity,
        list.items.map(parseField).filter((f): f is FieldRecord => f !== null)
      );
    }
    const existingFields = fieldCache.get(definition.entity)!;
    const matches = existingFields.filter((f) => normalize(f.name) === normalize(definition.name));
    const label = `${definition.entity}: ${definition.name}`;

    let field: FieldRecord | null = null;
    if (matches.length > 1) {
      steps.push({ entity: 'field', name: label, action: 'conflict', detail: 'duplicate field names' });
      ready = false;
      continue;
    } else if (matches.length === 1) {
      field = matches[0]!;
      steps.push({ entity: 'field', name: label, action: 'existing' });
    } else if (dryRun) {
      steps.push({ entity: 'field', name: label, action: 'would_create' });
      ready = false;
      continue;
    } else {
      const body: Record<string, unknown> = { field_name: definition.name, field_type: definition.fieldType };
      if ('options' in definition) {
        body.options = definition.options.map((option) => ({ label: option }));
      }
      const created = await runPipedriveWrite(() =>
        pipedriveProvider.request<unknown>(connectionId, 'POST', endpoint, body)
      );
      field = parseField(created.data);
      if (!field) {throw new Error(`Pipedrive did not return the created field "${definition.name}"`);}
      existingFields.push(field);
      steps.push({ entity: 'field', name: label, action: 'created' });
    }

    const mapping: GdcFieldMapping = { code: field.code };
    if ('options' in definition) {
      mapping.options = {};
      const missing = definition.options.filter(
        (option) => !field!.options.some((o) => normalize(o.label) === normalize(option))
      );
      if (missing.length > 0 && !dryRun) {
        const added = await runPipedriveWrite(() =>
          pipedriveProvider.request<unknown>(
            connectionId, 'POST',
            `${endpoint}/${field!.code}/options`,
            missing.map((option) => ({ label: option }))
          )
        );
        for (const option of asArray(added.data).map(parseOption)) {
          if (option) {field.options.push(option);}
        }
      }
      for (const option of definition.options) {
        const found = field.options.find((o) => normalize(o.label) === normalize(option));
        if (found) {
          mapping.options[option] = found.id;
        } else {
          steps.push({
            entity: 'field_option',
            name: `${label} = ${option}`,
            action: dryRun ? 'would_create' : 'conflict',
          });
          ready = false;
        }
      }
    }
    fields[definition.key] = mapping;
  }

  // ---------- Activity types ----------
  const activityTypes: Partial<Record<GdcActivityTypeKey, string>> = {};
  const typesResponse = await runPipedriveRequest(() =>
    pipedriveProvider.request<unknown[]>(connectionId, 'GET', 'activityTypes', undefined, 'v1')
  );
  const existingTypes = asArray(typesResponse.data)
    .map(parseActivityType)
    .filter((t): t is ActivityTypeRecord => t !== null && t.active);

  for (const type of GDC_ACTIVITY_TYPES) {
    const found =
      existingTypes.find((t) => normalize(t.name) === normalize(type.name)) ??
      existingTypes.find((t) => t.keyString === type.key);
    if (found) {
      activityTypes[type.key] = found.keyString;
      steps.push({ entity: 'activity_type', name: type.name, action: 'existing' });
    } else if (dryRun) {
      steps.push({ entity: 'activity_type', name: type.name, action: 'would_create' });
      ready = false;
    } else {
      const created = await runPipedriveWrite(() =>
        pipedriveProvider.request<unknown>(
          connectionId, 'POST',
          'activityTypes',
          { name: type.name, icon_key: type.iconKey },
          'v1'
        )
      );
      const createdType = parseActivityType(created.data);
      if (!createdType) {throw new Error(`Pipedrive did not return the created activity type "${type.name}"`);}
      activityTypes[type.key] = createdType.keyString;
      steps.push({ entity: 'activity_type', name: type.name, action: 'created' });
    }
  }

  // ---------- Products (24s / 38s, code = ERP SKU) ----------
  // Not required for the config: a missing product only blocks won deals that use it
  if (!options.skipProducts) {
    steps.push(...(await ensureGdcProducts(connectionId, dryRun || !canWriteProducts)));
  }

  const complete =
    ready &&
    pipelineId !== null &&
    GDC_STAGES.every((s) => stageIds[s.key] !== undefined) &&
    GDC_CUSTOM_FIELDS.every((f) => fields[f.key] !== undefined) &&
    GDC_ACTIVITY_TYPES.every((t) => activityTypes[t.key] !== undefined);

  let config: GdcResolvedConfig | null = null;
  if (complete) {
    config = {
      pipelineId: pipelineId!,
      stageIds: stageIds as Record<GdcStageKey, number>,
      fields: fields as Record<GdcFieldKey, GdcFieldMapping>,
      activityTypes: activityTypes as Record<GdcActivityTypeKey, string>,
      resolvedAt: new Date().toISOString(),
    };
    if (!dryRun) {
      await saveGdcConfig(connectionId, config);
    }
  }

  return { ready: complete, dryRun, steps, manualSteps: [...GDC_MANUAL_STEPS], config };
}

/**
 * Resolved GDC config for services. Uses the stored copy; if missing (e.g.
 * after a reconnect) it re-resolves from Pipedrive WITHOUT creating anything.
 * Throws when the account has not been set up yet.
 */
/** The connected Pipedrive account has not been set up for GDC yet (an expected state, not a fault) */
export class GdcSetupRequiredError extends Error {
  readonly code = 'setup_required' as const;
  constructor() {
    super('GDC Pipedrive setup has not been applied to the connected Pipedrive account. Open Settings > Integrations > Pipedrive and use "Check setup".');
    this.name = 'GdcSetupRequiredError';
  }
}

export async function getGdcConfig(connectionId: string): Promise<GdcResolvedConfig> {
  const stored = await loadGdcConfig(connectionId);
  if (stored) {
    return stored;
  }

  const report = await ensureGdcSetup({ dryRun: true, connectionId, skipProducts: true });
  if (!report.config) {
    throw new GdcSetupRequiredError();
  }
  await saveGdcConfig(connectionId, report.config);
  return report.config;
}

// ============================================
// PRODUCTS
// ============================================

interface ErpTireProduct {
  sku: string;
  name: string | null;
  base_price: number | null;
  rim_size: string | null;
  tire_size: string | null;
}

/**
 * Every active ERP 24" / 38" tire product needs a Pipedrive product whose code
 * is the ERP SKU (won deals map deal products to ERP lines by that code).
 * Missing products are created with the ERP name and base price (USD); reps
 * still set the deal price per deal. Existing products are never changed.
 */
export async function ensureGdcProducts(connectionId: string, dryRun: boolean): Promise<SetupStep[]> {
  const steps: SetupStep[] = [];
  const erpProducts = await fetchAllRows<ErpTireProduct>((from, to) =>
    db
      .from('products')
      .select('sku, name, base_price, rim_size, tire_size')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('sku', { ascending: true })
      .range(from, to)
  );
  const tires = erpProducts.filter(
    (p) => p.sku && classifyTireSize({ rimSize: p.rim_size, tireSize: p.tire_size, sku: p.sku, name: p.name }) !== 'other'
  );
  if (tires.length === 0) {
    return [{ entity: 'product', name: '24s / 38s', action: 'warning', detail: 'no active ERP products with a 24" or 38" size were found' }];
  }

  const pipedriveProducts = await pipedriveProvider.fetchAllV2<{ id?: number; code?: string | null; name?: string }>(
    connectionId,
    'products',
    undefined,
    runPipedriveRequest
  );
  const byCode = new Map<string, number>();
  for (const product of pipedriveProducts.items) {
    const code = product.code?.trim();
    if (code) {byCode.set(code, (byCode.get(code) ?? 0) + 1);}
  }

  for (const product of tires) {
    const sku = product.sku.trim();
    const label = `${sku}${product.name ? ` (${product.name})` : ''}`;
    const count = byCode.get(sku) ?? 0;
    if (count > 1) {
      steps.push({ entity: 'product', name: label, action: 'conflict', detail: `${count} Pipedrive products have code ${sku}; keep one` });
    } else if (count === 1) {
      steps.push({ entity: 'product', name: label, action: 'existing' });
    } else if (!pipedriveProducts.complete) {
      steps.push({ entity: 'product', name: label, action: 'warning', detail: 'product list incomplete; not created to avoid a duplicate' });
    } else if (dryRun) {
      steps.push({ entity: 'product', name: label, action: 'would_create' });
    } else {
      try {
        await runPipedriveWrite(() =>
          pipedriveProvider.request(connectionId, 'POST', 'products', {
            name: product.name || sku,
            code: sku,
            prices: [{ currency: 'USD', price: (product.base_price ?? 0) / 100 }],
          })
        );
      } catch (error) {
        const denied = explainSetupPermissionError(error);
        if (!denied) {throw error;}
        steps.push({ entity: 'product', name: label, action: 'conflict', detail: denied });
        break;
      }
      byCode.set(sku, 1);
      steps.push({ entity: 'product', name: label, action: 'created' });
    }
  }
  return steps;
}

// ============================================
// PERMISSION MESSAGES
// ============================================

const SCOPE_PURPOSE: Record<string, string> = {
  admin: 'create the GDC Sales pipeline, stages, custom fields and activity types',
  'products:full': 'create the 24s / 38s products',
};

/** Scope names as shown in Pipedrive Developer Hub (OAuth & access scopes) */
const SCOPE_LABEL: Record<string, string> = {
  admin: 'Administer account',
  'products:full': 'Products: Full access',
};

const scopeName = (scope: string) => (SCOPE_LABEL[scope] ? `"${SCOPE_LABEL[scope]}" (${scope})` : `"${scope}"`);

function missingScopeDetail(scope: string): string {
  return (
    `the Pipedrive app does not have the ${scopeName(scope)} scope needed to ${SCOPE_PURPOSE[scope] ?? 'run setup'}. ` +
    'Turn it on in Pipedrive Developer Hub (your app > OAuth & access scopes), then Disconnect and Connect Pipedrive again' +
    (scope === 'admin' ? ' as a Pipedrive company admin.' : '.')
  );
}

/**
 * Readable message for a 403 from Pipedrive during setup: the app lacks a
 * scope or the connected user is not allowed to manage company settings.
 */
export function explainSetupPermissionError(error: unknown): string | null {
  if (!isPipedriveApiError(error) || error.status !== 403) {
    return null;
  }
  const scope = /products/.test(error.endpoint) ? 'products:full' : 'admin';
  return (
    `Pipedrive refused ${error.endpoint} (HTTP 403). The connected user or app is not allowed to ${SCOPE_PURPOSE[scope]}. ` +
    `Make sure the app has the ${scopeName(scope)} scope in Pipedrive Developer Hub and that the user who connected Pipedrive is a company admin, ` +
    'then Disconnect and Connect Pipedrive again and re-run "Check setup".'
  );
}
