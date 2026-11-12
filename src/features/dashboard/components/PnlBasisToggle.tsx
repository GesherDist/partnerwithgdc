'use client';

/**
 * Cash / Accrual toggle (Ankur, Nov 11 2026 email: "a toggle on every tab to see
 * cash and accrual"). Nov 12 2026.
 *
 * One switch in the dashboard header for every tab: the QuickBooks P&L figures
 * (Revenue, Blended Margin, Revenue / Margin charts, Profitability, OPEX Run
 * Rate, OPEX by month, drill-downs) follow it. The basis is shared through
 * PnlBasisContext so the tabs and drill-down buttons use the same one.
 */

import { createContext, useContext } from 'react';
import { cn } from '@/shared/lib/utils';
import { PNL_BASES, type PnlBasis } from '../lib/pnl-basis';

export const PnlBasisContext = createContext<PnlBasis>('Cash');

/** Basis chosen in the dashboard header (Cash outside the dashboard) */
export function usePnlBasis(): PnlBasis {
  return useContext(PnlBasisContext);
}

interface PnlBasisToggleProps {
  value: PnlBasis;
  onChange: (basis: PnlBasis) => void;
  /** Bases the latest QuickBooks snapshot can show */
  available: Record<PnlBasis, boolean>;
  disabled?: boolean;
}

export function PnlBasisToggle({ value, onChange, available, disabled }: PnlBasisToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">P&amp;L basis</span>
      <div role="radiogroup" aria-label="P&L basis" className="inline-flex rounded-md border bg-background p-0.5">
        {PNL_BASES.map((basis) => {
          const unavailable = !available[basis];
          const selected = value === basis;
          return (
            <button
              key={basis}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled || unavailable}
              title={unavailable ? `${basis} figures arrive with the next QuickBooks sync` : `Show QuickBooks P&L figures on ${basis} basis`}
              onClick={() => !selected && onChange(basis)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {basis}
            </button>
          );
        })}
      </div>
    </div>
  );
}
