'use client';

/**
 * IntegrationsSettings
 *
 * The Integrations section of the Settings page: one panel per external system.
 *
 * Preview only — see the note rendered at the top of the section. Neither panel
 * reaches a real provider yet.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */

import { memo } from 'react';
import { FlaskConical } from 'lucide-react';

import { QuickBooksCard } from './QuickBooksCard';
import { PipedriveCard } from './PipedriveCard';

function IntegrationsSettingsComponent() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Integrations
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect the external systems Gesher reads from and writes to.
        </p>
      </div>

      {/* Honest label: these panels look real but nothing is wired up behind them. */}
      <div className="flex gap-3 rounded-lg border border-dashed bg-muted/40 p-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Preview.</span> These panels are
          interface only — connecting, testing and disconnecting move on-screen state and
          do not reach QuickBooks or Pipedrive yet.
        </p>
      </div>

      <div className="grid gap-6">
        <QuickBooksCard />
        <PipedriveCard />
      </div>
    </section>
  );
}

// Export memoized component
export const IntegrationsSettings = memo(IntegrationsSettingsComponent);
