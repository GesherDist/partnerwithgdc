/**
 * Daily rep digest (GDC spec: reminders / to-do list / daily email).
 *
 * For each active Pipedrive user who owns open work:
 * - overdue activities (not done, due before today)
 * - activities due today
 * - open GDC Sales deals without a next activity ("no next step")
 *
 * Reps also see the same overdue / to-do items natively in Pipedrive
 * (Activities list, reminders). This email is sent by the daily cron
 * /api/cron/pipedrive-daily-digest via the existing SMTP configuration.
 */

import nodemailer from 'nodemailer';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest } from '../lib/rate-limiter';
import { GDC_PIPELINE_NAME } from './config';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId } from './settings';

// ============================================
// TYPES
// ============================================

export interface DigestActivity {
  id: number;
  subject: string;
  type: string;
  dueDate: string;
  dealId: number | null;
  orgId: number | null;
}

export interface DigestDeal {
  id: number;
  title: string;
}

export interface RepDigest {
  userId: number;
  name: string;
  email: string;
  overdue: DigestActivity[];
  dueToday: DigestActivity[];
  dealsWithoutNextStep: DigestDeal[];
}

export interface DigestRunResult {
  date: string;
  timeZone: string;
  dryRun: boolean;
  digests: Array<RepDigest & { sent: boolean; error?: string }>;
}

// ============================================
// DATES
// ============================================

/** Company time zone for "today" / "overdue" (IANA name). Defaults to UTC. */
export function getGdcTimeZone(): string {
  return process.env.GDC_TIMEZONE || 'UTC';
}

/** YYYY-MM-DD for `date` in `timeZone` */
export function localDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ============================================
// PARSING
// ============================================

function toId(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

function parseActivity(raw: unknown): (DigestActivity & { done: boolean; ownerId: number | null }) | null {
  const r = raw as Record<string, unknown>;
  const id = toId(r?.id);
  if (id === null || r.is_deleted === true) {return null;}
  return {
    id,
    subject: String(r.subject ?? ''),
    type: String(r.type ?? ''),
    dueDate: typeof r.due_date === 'string' ? r.due_date : '',
    dealId: toId(r.deal_id),
    orgId: toId(r.org_id),
    done: r.done === true || r.done === 1,
    ownerId: toId(r.owner_id ?? r.user_id),
  };
}

// ============================================
// BUILD
// ============================================

/**
 * Split activities into overdue / due today for one rep.
 */
export function classifyActivities(
  activities: Array<DigestActivity & { done: boolean }>,
  today: string
): { overdue: DigestActivity[]; dueToday: DigestActivity[] } {
  const open = activities.filter((a) => !a.done && a.dueDate);
  const strip = ({ id, subject, type, dueDate, dealId, orgId }: DigestActivity) => ({ id, subject, type, dueDate, dealId, orgId });
  return {
    overdue: open.filter((a) => a.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(strip),
    dueToday: open.filter((a) => a.dueDate === today).map(strip),
  };
}

export async function buildDailyDigests(now: Date = new Date()): Promise<{ date: string; digests: RepDigest[] }> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    throw new Error('Pipedrive is not connected');
  }
  const config = await getGdcConfig(connectionId);
  const today = localDateString(now, getGdcTimeZone());

  const usersResponse = await runPipedriveRequest(() =>
    pipedriveProvider.request<unknown[]>(connectionId, 'GET', 'users', undefined, 'v1')
  );
  const users = (Array.isArray(usersResponse.data) ? usersResponse.data : [])
    .map((raw) => raw as { id?: unknown; name?: string; email?: string; active_flag?: boolean })
    .filter((u) => toId(u.id) !== null && u.email && u.active_flag !== false);

  const digests: RepDigest[] = [];
  for (const user of users) {
    const userId = toId(user.id)!;

    const activities = await pipedriveProvider.fetchAllV2<unknown>(
      connectionId,
      'activities',
      new URLSearchParams({ owner_id: String(userId), done: 'false' }),
      runPipedriveRequest
    );
    const { overdue, dueToday } = classifyActivities(
      activities.items.map(parseActivity).filter((a): a is NonNullable<ReturnType<typeof parseActivity>> => a !== null),
      today
    );

    const deals = await pipedriveProvider.fetchAllV2<Record<string, unknown>>(
      connectionId,
      'deals',
      new URLSearchParams({
        owner_id: String(userId),
        pipeline_id: String(config.pipelineId),
        status: 'open',
        include_fields: 'next_activity_id',
      }),
      runPipedriveRequest
    );
    const dealsWithoutNextStep = deals.items
      .filter((deal) => toId(deal.id) !== null && !toId(deal.next_activity_id))
      .map((deal) => ({ id: toId(deal.id)!, title: String(deal.title ?? '') }));

    if (overdue.length + dueToday.length + dealsWithoutNextStep.length > 0) {
      digests.push({
        userId,
        name: user.name ?? '',
        email: user.email!,
        overdue,
        dueToday,
        dealsWithoutNextStep,
      });
    }
  }

  return { date: today, digests };
}

// ============================================
// RENDER & SEND
// ============================================

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderDigestEmail(digest: RepDigest, date: string, companyDomain?: string | null) {
  const base = companyDomain ? `https://${companyDomain}.pipedrive.com` : null;
  const dealLink = (id: number, label: string) =>
    base ? `<a href="${base}/deal/${id}">${escapeHtml(label)}</a>` : escapeHtml(label);
  const activityLine = (a: DigestActivity) =>
    `${escapeHtml(a.dueDate)} · ${escapeHtml(a.type)} · ${a.dealId ? dealLink(a.dealId, a.subject || `Deal #${a.dealId}`) : escapeHtml(a.subject)}`;

  const section = (title: string, items: string[]) =>
    items.length === 0 ? '' : `<h3>${title} (${items.length})</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

  const html =
    `<p>Good morning ${escapeHtml(digest.name)}, here is your Pipedrive to-do list for ${date}.</p>` +
    section('Overdue activities', digest.overdue.map(activityLine)) +
    section('Due today', digest.dueToday.map(activityLine)) +
    section(
      `${GDC_PIPELINE_NAME} deals without a next step`,
      digest.dealsWithoutNextStep.map((d) => `${dealLink(d.id, d.title)} — schedule the next activity`)
    );

  const text = [
    `Pipedrive to-do list for ${date}`,
    ...(digest.overdue.length ? ['', 'Overdue:', ...digest.overdue.map((a) => `- ${a.dueDate} ${a.type}: ${a.subject}`)] : []),
    ...(digest.dueToday.length ? ['', 'Due today:', ...digest.dueToday.map((a) => `- ${a.type}: ${a.subject}`)] : []),
    ...(digest.dealsWithoutNextStep.length
      ? ['', 'Deals without a next step:', ...digest.dealsWithoutNextStep.map((d) => `- ${d.title}`)]
      : []),
  ].join('\n');

  return {
    subject: `Pipedrive: ${digest.overdue.length} overdue, ${digest.dueToday.length} due today, ${digest.dealsWithoutNextStep.length} deals need a next step`,
    html,
    text,
  };
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) {
    throw new Error('SMTP credentials not configured (SMTP_USER, SMTP_PASSWORD)');
  }
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.postmarkapp.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Build and (unless dryRun) send the daily digests.
 */
export async function runDailyDigest(options: { dryRun?: boolean; now?: Date } = {}): Promise<DigestRunResult> {
  const { date, digests } = await buildDailyDigests(options.now);
  const status = await pipedriveProvider.getConnectionStatus();
  const companyDomain = status.environment ?? null;

  const results: DigestRunResult['digests'] = [];
  const transporter = options.dryRun ? null : createTransporter();
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@gesherdistribution.com';
  const fromName = process.env.SMTP_FROM_NAME || 'Gesher Distribution';

  for (const digest of digests) {
    if (!transporter) {
      results.push({ ...digest, sent: false });
      continue;
    }
    try {
      const email = renderDigestEmail(digest, date, companyDomain);
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: digest.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      results.push({ ...digest, sent: true });
    } catch (error) {
      results.push({ ...digest, sent: false, error: error instanceof Error ? error.message : 'send failed' });
    }
  }

  return { date, timeZone: getGdcTimeZone(), dryRun: options.dryRun ?? false, digests: results };
}
