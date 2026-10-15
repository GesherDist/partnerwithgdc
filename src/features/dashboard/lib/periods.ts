/**
 * Executive dashboard periods (Ankur's spec, "Notation and Conventions")
 *
 *   MTD  first day of the current month → as-of date
 *   T90  trailing 90 calendar days ending on the as-of date
 *   YTD  January 1 → as-of date
 *   PY   the same period one year earlier (for MTD/T90/YTD/PY tables: the
 *        prior-year YTD, Jan 1 → as-of date minus one year)
 *   PM   the most recent completed calendar month
 *
 * Dates are business dates (YYYY-MM-DD) in America/New_York (GDC_TIMEZONE).
 */

export type PeriodKey = 'mtd' | 't90' | 'ytd' | 'py' | 'pm';

export interface DateRange {
  from: string;
  to: string;
  /** Calendar days in the range, inclusive */
  days: number;
}

const BUSINESS_TZ = process.env.GDC_TIMEZONE || 'America/New_York';

export function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date());
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  // Feb 29 → Feb 28 in a non-leap year
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(y + years, m - 1, Math.min(d, last))));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

export function monthStart(iso: string, monthsBack = 0): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return toIso(new Date(Date.UTC(y, m - 1 - monthsBack, 1)));
}

export function monthEnd(monthStartIso: string): string {
  const [y, m] = monthStartIso.split('-').map(Number) as [number, number];
  return toIso(new Date(Date.UTC(y, m, 0)));
}

const range = (from: string, to: string): DateRange => ({ from, to, days: daysBetween(from, to) + 1 });

export function getPeriods(asOf: string = businessToday()): Record<PeriodKey, DateRange> {
  const pmStart = monthStart(asOf, 1);
  return {
    mtd: range(monthStart(asOf), asOf),
    t90: range(addDays(asOf, -89), asOf),
    ytd: range(`${asOf.slice(0, 4)}-01-01`, asOf),
    py: range(`${Number(asOf.slice(0, 4)) - 1}-01-01`, addYears(asOf, -1)),
    pm: range(pmStart, monthEnd(pmStart)),
  };
}

/** Month-end dates strictly before the as-of date, from `from` (inclusive) */
export function monthEndsBetween(from: string, asOf: string): string[] {
  const ends: string[] = [];
  let start = monthStart(from);
  for (let i = 0; i < 36; i++) {
    const end = monthEnd(start);
    if (end >= asOf) {
      break;
    }
    if (end >= from) {
      ends.push(end);
    }
    const [y, m] = start.split('-').map(Number) as [number, number];
    start = toIso(new Date(Date.UTC(y, m, 1)));
  }
  return ends;
}

export const inRange = (date: string | null | undefined, r: DateRange) => Boolean(date && date >= r.from && date <= r.to);
