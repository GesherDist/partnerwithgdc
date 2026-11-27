'use client';

/**
 * CMA CGM journey summary (Nov 27 2026)
 *
 * Readable view of the newest CMA reply: where the container is, vessel and
 * ports, transit days, delays against CMA's plan, time spent at each place,
 * and the timeline. Shown in the eye-icon dialog on Shipment Orders.
 */

import { AlertTriangle, MapPin, Ship, Clock, Route, ExternalLink } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { CmaJourneySummary } from '@/features/shipping/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** CMA's local time at the place, e.g. "Nov 25, 2026 08:23" (no timezone shift) */
function placeTime(iso?: string, withTime = true): string {
  if (!iso) {
    return '-';
  }
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) {
    return iso;
  }
  const date = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  return withTime && m[4] ? `${date} ${m[4]}:${m[5]}` : date;
}

function days(n?: number): string {
  if (n === undefined) {
    return '-';
  }
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || '-'}</p>
    </div>
  );
}

interface Props {
  summary: CmaJourneySummary;
  summaryFrom: string | null;
}

export function CmaJourneySummaryView({ summary, summaryFrom }: Props) {
  // if (summary.otherTrip) {
  //   return (
  //     <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
  //       <p className="font-medium">Container reused on another booking</p>
  //       <p className="mt-1">
  //         CMA now shows another customer&apos;s trip ({summary.otherTrip.label || 'new trip'}
  //         {summary.otherTrip.startedAt ? ` on ${placeTime(summary.otherTrip.startedAt, false)}` : ''}
  //         {summary.otherTrip.location ? `, ${summary.otherTrip.location}` : ''}). This load&apos;s own journey is no
  //         longer in CMA&apos;s data - please confirm the delivery date.
  //       </p>
  //     </div>
  //   );
  // }
  // Nov 27 2026: reuse notice on top; our own trip below when it was fetched
  const hasOwnTrip = summary.timeline.length > 0;
  const reuseNotice = summary.otherTrip ? (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Container reused on another booking</p>
      <p className="mt-1">
        CMA now shows a new booking for this container ({summary.otherTrip.label || 'new trip'}
        {summary.otherTrip.startedAt ? ` on ${placeTime(summary.otherTrip.startedAt, false)}` : ''}
        {summary.otherTrip.location ? `, ${summary.otherTrip.location}` : ''}), so this load was already unloaded.
        {hasOwnTrip
          ? " Below is this load's own trip from CMA's history - please confirm the delivery date and mark it Delivered."
          : ' Please confirm the delivery date and mark it Delivered.'}
      </p>
    </div>
  ) : null;
  if (!hasOwnTrip) {
    return reuseNotice;
  }

  const { current } = summary;
  const mapUrl =
    current?.latitude && current?.longitude
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${current.latitude},${current.longitude}`)}`
      : null;

  return (
    <div className="space-y-4">
      {reuseNotice}
      {summaryFrom && (
        <p className="text-xs text-muted-foreground">
          From CMA&apos;s reply of {new Date(summaryFrom).toLocaleString('en-US')}. Times are local to each place.
        </p>
      )}

      {/* Where it is now */}
      {current && (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4" /> Where it is now
          </div>
          <p className="text-sm font-medium">
            {current.label || '-'} · {current.place || '-'}
          </p>
          <p className="text-xs text-muted-foreground">
            {placeTime(current.date)}
            {current.mode ? ` · by ${current.mode.toLowerCase()}` : ''}
            {current.laden ? ` · ${current.laden === 'EMPTY' ? 'empty' : 'loaded'}` : ''}
          </p>
          {(current.facility || current.address) && (
            <p className="mt-1 text-xs">
              {current.facility}
              {current.facility && current.address ? ' - ' : ''}
              {current.address}
            </p>
          )}
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View place on map <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {summary.progress && (
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Journey progress</span>
                <span>
                  Leg {summary.progress.leg} of {summary.progress.total}
                </span>
              </div>
              <div className="h-1.5 rounded bg-muted">
                <div
                  className="h-1.5 rounded bg-primary"
                  style={{ width: `${Math.min(100, (summary.progress.leg / summary.progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vessel and ports */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Ship className="h-4 w-4" /> Vessel &amp; ports
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Vessel" value={summary.vessel?.name} />
          <Field label="Voyage / service" value={[summary.vessel?.voyage, summary.vessel?.service].filter(Boolean).join(' · ')} />
          <Field label="Container type" value={summary.containerType} />
          <Field label="Port of loading" value={summary.portOfLoading?.place} />
          <Field label="Departed" value={placeTime(summary.portOfLoading?.departedAt, false)} />
          <Field label="Port of discharge" value={summary.portOfDischarge?.place} />
          <Field
            label="Arrived at port"
            value={
              summary.portOfDischarge?.arrivedAt
                ? placeTime(summary.portOfDischarge.arrivedAt, false)
                : summary.estimatedArrival
                  ? `ETA ${placeTime(summary.estimatedArrival, false)}`
                  : '-'
            }
          />
          <Field label="Days at sea" value={days(summary.oceanDays)} />
          <Field label="Total so far (first to latest event)" value={days(summary.totalDays)} />
        </div>
      </div>

      {/* Delays against CMA's plan */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4" /> Against CMA&apos;s plan
        </div>
        {summary.delays.length === 0 ? (
          <p className="text-xs text-muted-foreground">No move more than a day off CMA&apos;s plan.</p>
        ) : (
          <div className="space-y-1">
            {summary.delays.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    d.days > 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'
                  )}
                >
                  {d.days > 0 ? `${d.days} days late` : `${Math.abs(d.days)} days early`}
                </Badge>
                <span className="font-medium">{d.label}</span>
                {d.place && <span>· {d.place}</span>}
                <span className="text-muted-foreground">
                  · planned {placeTime(d.planned, false)}, actual {placeTime(d.actual, false)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time spent at each place */}
      {summary.dwell.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4" /> Time spent at each place
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.dwell.map((d, i) => (
              <Field key={i} label={d.place} value={days(d.days)} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {summary.timeline.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Route className="h-4 w-4" /> Journey ({summary.timeline.length} events)
          </div>
          <ol className="relative space-y-2 border-l pl-4">
            {[...summary.timeline].reverse().map((t, i) => (
              <li key={i} className="text-xs">
                <span
                  className={cn(
                    'absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border bg-background',
                    i === 0 && 'border-primary bg-primary'
                  )}
                />
                <span className="font-medium">{t.label || '-'}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {t.place || '-'} · {placeTime(t.date)}
                  {t.mode ? ` · ${t.mode.toLowerCase()}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
