/**
 * Call / site-visit reports (GDC spec: Outcome, summary, next step).
 *
 * When a Call or Site visit is marked done, its note must hold the report:
 *
 *   Outcome: Connected | Voicemail | No answer
 *   Summary: what was discussed
 *   Next step: what happens next (or a scheduled next activity on the deal)
 *
 * If anything is missing, Gesher adds ONE task for the activity owner, due
 * today, asking to complete the report. The task appears in Pipedrive's
 * activity list, reminders and the daily digest. Pipedrive's own required
 * fields (if the plan supports them) can enforce this at entry time as well;
 * this check works regardless of plan.
 */

import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import { GDC_ACTIVITY_OUTCOMES, GDC_CONTACT_ACTIVITY_TYPES } from './config';
import type { GdcResolvedConfig } from './settings';
import { getGdcTimeZone, localDateString } from './daily-digest.service';

/** Subject prefix of report-reminder tasks (identifies them for idempotency) */
export const CALL_REPORT_TASK_MARKER = '[GDC Report]';

export const CALL_REPORT_TEMPLATE = [
  `Outcome: ${GDC_ACTIVITY_OUTCOMES.join(' | ')}`,
  'Summary: what was discussed',
  'Next step: what happens next',
].join('\n');

export interface CallReportCheck {
  complete: boolean;
  outcome: (typeof GDC_ACTIVITY_OUTCOMES)[number] | null;
  missing: Array<'outcome' | 'summary' | 'next step'>;
}

function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function lineValue(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^\\s*${label}\\s*[:\\-]\\s*(.+)$`, 'im'));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/**
 * Check an activity note against the report format. `hasNextActivity` counts
 * as the next step when the note has no "Next step:" line.
 */
export function evaluateCallReport(note: string | null | undefined, hasNextActivity = false): CallReportCheck {
  const text = plainText(note);
  const outcomeText = lineValue(text, 'outcome')?.toLowerCase() ?? '';
  const outcome = GDC_ACTIVITY_OUTCOMES.find((o) => outcomeText.startsWith(o.toLowerCase())) ?? null;
  const missing: CallReportCheck['missing'] = [];
  if (!outcome) {missing.push('outcome');}
  if (!lineValue(text, 'summary')) {missing.push('summary');}
  if (!lineValue(text, 'next step') && !hasNextActivity) {missing.push('next step');}
  return { complete: missing.length === 0, outcome, missing };
}

export interface CompletedActivity {
  id: number;
  type: string;
  subject: string;
  note: string | null;
  ownerId: number | null;
  dealId: number | null;
  leadId: string | null;
  personId: number | null;
  orgId: number | null;
}

export type CallReportStatus = 'not_applicable' | 'complete' | 'task_exists' | 'task_created';

async function dealHasNextActivity(connectionId: string, dealId: number): Promise<boolean> {
  const response = await runPipedriveRequest(() =>
    pipedriveProvider.request<{ next_activity_id?: number | null }>(
      connectionId,
      'GET',
      `deals/${dealId}?include_fields=next_activity_id`
    )
  );
  return Boolean(response.data?.next_activity_id);
}

/**
 * For a just-completed Call / Site visit: if its report is incomplete, make
 * sure exactly one open reminder task exists for the owner.
 */
export async function ensureCallReport(
  connectionId: string,
  config: GdcResolvedConfig,
  activity: CompletedActivity,
  now: Date = new Date()
): Promise<{ status: CallReportStatus; missing: CallReportCheck['missing'] }> {
  const reportTypes = GDC_CONTACT_ACTIVITY_TYPES.map((key) => config.activityTypes[key]);
  if (!reportTypes.includes(activity.type) || !activity.ownerId) {
    return { status: 'not_applicable', missing: [] };
  }

  let check = evaluateCallReport(activity.note);
  if (check.missing.includes('next step') && activity.dealId) {
    check = evaluateCallReport(activity.note, await dealHasNextActivity(connectionId, activity.dealId));
  }
  if (check.complete) {
    return { status: 'complete', missing: [] };
  }

  const tag = `${CALL_REPORT_TASK_MARKER} #${activity.id}`;
  const open = await pipedriveProvider.fetchAllV2<{ subject?: string }>(
    connectionId,
    'activities',
    new URLSearchParams({ owner_id: String(activity.ownerId), done: 'false' }),
    runPipedriveRequest
  );
  if (open.items.some((item) => item.subject?.startsWith(tag))) {
    return { status: 'task_exists', missing: check.missing };
  }

  const body: Record<string, unknown> = {
    subject: `${tag} Complete the report for "${activity.subject || 'activity'}"`,
    type: config.activityTypes.task,
    owner_id: activity.ownerId,
    due_date: localDateString(now, getGdcTimeZone()),
    note: `Missing: ${check.missing.join(', ')}.<br>Add to the activity note:<br>${CALL_REPORT_TEMPLATE.replace(/\n/g, '<br>')}`,
  };
  if (activity.dealId) {body.deal_id = activity.dealId;}
  if (activity.leadId) {body.lead_id = activity.leadId;}
  if (activity.personId) {body.person_id = activity.personId;}
  if (activity.orgId) {body.org_id = activity.orgId;}

  await runPipedriveWrite(() => pipedriveProvider.request(connectionId, 'POST', 'activities', body));
  return { status: 'task_created', missing: check.missing };
}
