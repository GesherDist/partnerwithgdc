/**
 * Monthly rep dashboard (GDC spec), per Pipedrive user.
 *
 * Definitions (month boundaries in GDC_TIMEZONE, see daily-digest.service).
 * Activity dates follow RepReportOptions.dateBasis: completion date (default)
 * or due date; every report states the rules it used in its notes.
 * 1. New leads contacted: GDC Sales deals whose FIRST completed Call or Site
 *    visit falls in the month, counted once per deal and credited to the owner
 *    of that first activity. With includeLeadsInbox (default), Pipedrive Leads
 *    inbox items count the same way.
 * 2. Follow-ups: completed activities of each follow-up type in the month,
 *    credited to the activity owner, for all deals and leads.
 * 3. Sales: GDC Sales deals won in the month (won_time, archived deals
 *    included), credited to the deal owner: count, total value (USD) and tire
 *    count. Tire count comes from the deal's "Tire Count" field (set when the
 *    ERP quote is created); otherwise it is derived from the deal's 24"/38"
 *    products; deals with neither are reported, not guessed.
 *
 * Open decisions for Ankur: completion vs due date, whether Leads inbox items
 * count as new leads, and the company time zone.
 */

import { db } from '@/shared/lib/supabase/database';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest } from '../lib/rate-limiter';
import {
  GDC_ACTIVITY_TYPES,
  GDC_CONTACT_ACTIVITY_TYPES,
  GDC_FOLLOW_UP_ACTIVITY_TYPES,
  GDC_PIPELINE_NAME,
  type GdcActivityTypeKey,
} from './config';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId, type GdcResolvedConfig } from './settings';
import { getGdcTimeZone, localDateString } from './daily-digest.service';
import { classifyTireSize } from './purchase-history.service';
import { parseDealProducts } from './deal-erp.service';

// ============================================
// TYPES
// ============================================

export interface ReportActivity {
  id: number;
  type: string;
  done: boolean;
  dueDate: string;
  /** When it was marked done (UTC timestamp from Pipedrive), if known */
  doneTime?: string | null;
  ownerId: number | null;
  dealId: number | null;
  /** Pipedrive Leads inbox item the activity belongs to, if any */
  leadId?: string | null;
}

/**
 * Which date puts an activity in a month:
 * - 'completed': the day it was marked done (company time zone). Activities
 *   without a completion time fall back to their due date (counted in notes).
 * - 'due': its due date.
 */
export type ActivityDateBasis = 'completed' | 'due';

export interface RepReportOptions {
  dateBasis: ActivityDateBasis;
  /** Count first contacts on Pipedrive Leads inbox items, not only GDC Sales deals */
  includeLeadsInbox: boolean;
}

/** Defaults pending Ankur's confirmation (stated in every report's notes) */
export const DEFAULT_REP_REPORT_OPTIONS: RepReportOptions = { dateBasis: 'completed', includeLeadsInbox: true };

export interface ReportDeal {
  id: number;
  ownerId: number | null;
  pipelineId: number | null;
  status: string;
  value: number;
  currency: string | null;
  wonTime: string | null;
  tireCount: number | null;
}

export interface RepMonthlyRow {
  userId: number;
  name: string;
  newLeadsContacted: number;
  followUpsByType: Partial<Record<GdcActivityTypeKey, number>>;
  followUpsTotal: number;
  wonDeals: number;
  wonValue: number;
  tireCount: number;
}

export interface RepMonthlyReport {
  month: string;
  timeZone: string;
  options: RepReportOptions;
  rows: RepMonthlyRow[];
  notes: string[];
}

// ============================================
// PURE CALCULATION (unit-tested)
// ============================================

function emptyRow(userId: number, name: string): RepMonthlyRow {
  return {
    userId,
    name,
    newLeadsContacted: 0,
    followUpsByType: {},
    followUpsTotal: 0,
    wonDeals: 0,
    wonValue: 0,
    tireCount: 0,
  };
}

/**
 * Compute the three reports from already-fetched data.
 * `month` is YYYY-MM; dates are compared as local YYYY-MM-DD strings.
 */
export function computeRepMonthlyReport(input: {
  month: string;
  timeZone: string;
  config: Pick<GdcResolvedConfig, 'pipelineId' | 'activityTypes'>;
  users: Map<number, string>;
  activities: ReportActivity[];
  deals: ReportDeal[];
  /** Tire count derived from products for won deals without the field */
  derivedTireCounts?: Map<number, number>;
  options?: Partial<RepReportOptions>;
}): RepMonthlyReport {
  const { month, timeZone, config, users, activities, deals } = input;
  const options: RepReportOptions = { ...DEFAULT_REP_REPORT_OPTIONS, ...input.options };
  const inMonth = (localDate: string) => localDate.startsWith(`${month}-`);
  const rows = new Map<number, RepMonthlyRow>();
  const row = (userId: number) => {
    let r = rows.get(userId);
    if (!r) {
      r = emptyRow(userId, users.get(userId) ?? `User ${userId}`);
      rows.set(userId, r);
    }
    return r;
  };
  const notes: string[] = [];

  const typeKeyByPipedriveType = new Map<string, GdcActivityTypeKey>(
    GDC_ACTIVITY_TYPES.map((t) => [config.activityTypes[t.key as GdcActivityTypeKey], t.key as GdcActivityTypeKey])
  );
  const contactTypes = new Set(GDC_CONTACT_ACTIVITY_TYPES.map((k) => config.activityTypes[k]));
  const gdcDeals = new Set(deals.filter((d) => d.pipelineId === config.pipelineId).map((d) => d.id));
  // Date of each completed activity under the chosen basis
  let dueDateFallbacks = 0;
  const dated = activities
    .filter((a) => a.done)
    .map((a) => {
      let date = a.dueDate;
      if (options.dateBasis === 'completed') {
        const completed = parsePipedriveTime(a.doneTime);
        if (completed) {
          date = localDateString(completed, timeZone);
        } else {
          dueDateFallbacks += 1;
        }
      }
      return { activity: a, date };
    })
    .filter((entry) => entry.date);

  // 1. New leads contacted: first completed call/site visit per GDC deal
  //    (and per Leads inbox item when enabled), credited to its owner
  const firstContact = new Map<string, { activity: ReportActivity; date: string }>();
  for (const entry of dated) {
    const { activity } = entry;
    if (!contactTypes.has(activity.type)) {continue;}
    let key: string | null = null;
    if (activity.dealId && gdcDeals.has(activity.dealId)) {
      key = `deal:${activity.dealId}`;
    } else if (!activity.dealId && activity.leadId && options.includeLeadsInbox) {
      key = `lead:${activity.leadId}`;
    }
    if (!key) {continue;}
    const current = firstContact.get(key);
    if (!current || entry.date < current.date || (entry.date === current.date && activity.id < current.activity.id)) {
      firstContact.set(key, entry);
    }
  }
  for (const { activity, date } of firstContact.values()) {
    if (inMonth(date) && activity.ownerId) {
      row(activity.ownerId).newLeadsContacted += 1;
    }
  }

  // 2. Follow-ups by type
  const followUpTypes = new Set(GDC_FOLLOW_UP_ACTIVITY_TYPES.map((k) => config.activityTypes[k]));
  for (const { activity, date } of dated) {
    if (!inMonth(date) || !activity.ownerId || !followUpTypes.has(activity.type)) {continue;}
    const key = typeKeyByPipedriveType.get(activity.type)!;
    const r = row(activity.ownerId);
    r.followUpsByType[key] = (r.followUpsByType[key] ?? 0) + 1;
    r.followUpsTotal += 1;
  }

  // 3. Sales: won in month
  let nonUsd = 0;
  let missingTires = 0;
  for (const deal of deals) {
    if (deal.status !== 'won' || !deal.wonTime || !deal.ownerId || deal.pipelineId !== config.pipelineId) {continue;}
    const wonLocal = localDateString(new Date(deal.wonTime), timeZone);
    if (!inMonth(wonLocal)) {continue;}
    const r = row(deal.ownerId);
    r.wonDeals += 1;
    if (deal.currency && deal.currency !== 'USD') {
      nonUsd += 1;
    } else {
      r.wonValue += deal.value;
    }
    const tires = deal.tireCount ?? input.derivedTireCounts?.get(deal.id) ?? null;
    if (tires === null) {
      missingTires += 1;
    } else {
      r.tireCount += tires;
    }
  }
  if (nonUsd > 0) {notes.push(`${nonUsd} won deal(s) are not in USD and are excluded from the value total.`);}
  if (missingTires > 0) {notes.push(`${missingTires} won deal(s) have no products or Tire Count, so their tires are not counted.`);}

  if (dueDateFallbacks > 0) {
    notes.push(
      `${dueDateFallbacks} completed activit${dueDateFallbacks === 1 ? 'y has' : 'ies have'} no completion time; the due date was used.`
    );
  }
  notes.unshift(
    `Activities are counted by ${options.dateBasis === 'completed' ? 'completion date' : 'due date'} (${timeZone}). ` +
      `New leads contacted = first completed call or site visit per ${GDC_PIPELINE_NAME} deal` +
      `${options.includeLeadsInbox ? ' and per Leads inbox item' : ''}. Won deals count by won date.`
  );

  return {
    month,
    timeZone,
    options,
    rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)),
    notes,
  };
}

// ============================================
// DATA FETCH
// ============================================

/** Pipedrive timestamps: v1 "YYYY-MM-DD HH:MM:SS" (UTC) or ISO 8601 */
export function parsePipedriveTime(value: string | null | undefined): Date | null {
  if (!value) {return null;}
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toId(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Fetch from Pipedrive and compute the report for `month` (YYYY-MM).
 */
export async function getRepMonthlyReport(month: string, options: Partial<RepReportOptions> = {}): Promise<RepMonthlyReport> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Month must be in YYYY-MM format');
  }
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config = await getGdcConfig(connectionId);
  const timeZone = getGdcTimeZone();

  const usersResponse = await runPipedriveRequest(() =>
    pipedriveProvider.request<unknown[]>(connectionId, 'GET', 'users', undefined, 'v1')
  );
  const users = new Map<number, string>();
  for (const raw of Array.isArray(usersResponse.data) ? usersResponse.data : []) {
    const user = raw as { id?: unknown; name?: string };
    const id = toId(user.id);
    if (id !== null) {users.set(id, user.name ?? `User ${id}`);}
  }

  // All completed activities: "first contact" needs each deal's full history
  const activityList = await pipedriveProvider.fetchAllV2<Record<string, unknown>>(
    connectionId,
    'activities',
    new URLSearchParams({ done: 'true' }),
    runPipedriveRequest
  );
  const activities: ReportActivity[] = activityList.items
    .filter((a) => a.is_deleted !== true)
    .map((a) => ({
      id: toId(a.id) ?? 0,
      type: String(a.type ?? ''),
      done: a.done === true || a.done === 1,
      dueDate: typeof a.due_date === 'string' ? a.due_date : '',
      doneTime: typeof a.marked_as_done_time === 'string' ? a.marked_as_done_time : null,
      ownerId: toId(a.owner_id ?? a.user_id),
      dealId: toId(a.deal_id),
      leadId: typeof a.lead_id === 'string' && a.lead_id ? a.lead_id : null,
    }));

  const tireField = config.fields.deal_tire_count.code;
  // Archived deals are not returned by GET /deals; won deals are often archived later
  const dealParams = new URLSearchParams({ pipeline_id: String(config.pipelineId) });
  const dealList = await pipedriveProvider.fetchAllV2<Record<string, unknown>>(connectionId, 'deals', dealParams, runPipedriveRequest);
  const archivedList = await pipedriveProvider.fetchAllV2<Record<string, unknown>>(
    connectionId,
    'deals/archived',
    dealParams,
    runPipedriveRequest
  );
  const deals: ReportDeal[] = [...dealList.items, ...archivedList.items].map((d) => {
    const customFields = (d.custom_fields as Record<string, unknown>) ?? {};
    const tires = customFields[tireField];
    return {
      id: toId(d.id) ?? 0,
      ownerId: toId(d.owner_id ?? d.user_id),
      pipelineId: toId(d.pipeline_id),
      status: String(d.status ?? ''),
      value: typeof d.value === 'number' ? d.value : Number(d.value) || 0,
      currency: typeof d.currency === 'string' ? d.currency : null,
      wonTime: typeof d.won_time === 'string' ? d.won_time : null,
      tireCount: typeof tires === 'number' ? tires : tires !== null && tires !== undefined && tires !== '' ? Number(tires) : null,
    };
  });

  // Derive tires from products for won-in-month deals lacking the field
  const derivedTireCounts = new Map<number, number>();
  const needProducts = deals.filter(
    (d) =>
      d.status === 'won' &&
      d.tireCount === null &&
      d.wonTime &&
      localDateString(new Date(d.wonTime), timeZone).startsWith(`${month}-`)
  );
  const skuCache = new Map<number, string | null>();
  for (const deal of needProducts) {
    const response = await runPipedriveRequest(() =>
      pipedriveProvider.request<unknown>(connectionId, 'GET', `deals/${deal.id}/products`)
    );
    const { lines } = parseDealProducts(response.data);
    if (lines.length === 0) {continue;}
    let tires = 0;
    for (const line of lines) {
      if (!skuCache.has(line.productId)) {
        const product = await runPipedriveRequest(() =>
          pipedriveProvider.request<{ code?: string | null }>(connectionId, 'GET', `products/${line.productId}`)
        );
        skuCache.set(line.productId, product.data?.code?.trim() || null);
      }
      const sku = skuCache.get(line.productId);
      const { data: erpProduct } = sku
        ? await db.from('products').select('rim_size, tire_size, sku, name').eq('sku', sku).is('deleted_at', null).maybeSingle()
        : { data: null };
      const size = classifyTireSize({
        rimSize: erpProduct?.rim_size,
        tireSize: erpProduct?.tire_size,
        sku: sku ?? erpProduct?.sku,
        name: erpProduct?.name ?? line.name,
      });
      if (size !== 'other') {tires += line.quantity;}
    }
    derivedTireCounts.set(deal.id, tires);
  }

  const report = computeRepMonthlyReport({ month, timeZone, config, users, activities, deals, derivedTireCounts, options });
  if (!activityList.complete || !dealList.complete || !archivedList.complete) {
    report.notes.push('Pipedrive did not confirm complete lists; numbers may be understated.');
  }
  return report;
}
