'use client';

/**
 * IntegrationCard
 *
 * Presentational shell shared by every provider panel: branded tile, name,
 * description, status badge, body, and a footer action row.
 *
 * Provider-specific logic lives in the cards that use this — keeping the shell
 * dumb is what lets a third provider (Monday, per brief §6) drop in later
 * without touching the two that already exist.
 *
 * Performance Optimizations:
 * - Uses React.memo for all exported components to prevent unnecessary re-renders
 */

import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import type { IntegrationStatus } from '../types';

// ============================================
// STATUS BADGE
// ============================================

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: 'Connected',
  disconnected: 'Not connected',
  error: 'Action needed',
};

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  // Badge has no success variant, so we tint it the same way the users table does.
  connected: 'border-transparent bg-green-100 text-green-800 hover:bg-green-100',
  disconnected: '',
  error: 'border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100',
};

const STATUS_DOT: Record<IntegrationStatus, string> = {
  connected: 'bg-green-600',
  disconnected: 'bg-muted-foreground/40',
  error: 'bg-amber-500',
};

export const IntegrationStatusBadge = memo(function IntegrationStatusBadge({
  status,
}: {
  status: IntegrationStatus;
}) {
  return (
    <Badge
      variant={status === 'disconnected' ? 'secondary' : 'default'}
      className={cn('gap-1.5 font-medium', STATUS_STYLES[status])}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </Badge>
  );
});

// ============================================
// CARD
// ============================================

interface IntegrationCardProps {
  /** Provider name, e.g. "QuickBooks Online". */
  name: string;
  /** One line on what the integration actually does. */
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile — one accent colour per provider. */
  iconClassName?: string;
  status: IntegrationStatus;
  children: React.ReactNode;
  /** Action row pinned to the bottom of the card. */
  footer?: React.ReactNode;
}

export const IntegrationCard = memo(function IntegrationCard({
  name,
  description,
  icon: Icon,
  iconClassName,
  status,
  children,
  footer,
}: IntegrationCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
            iconClassName ?? 'bg-muted text-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{name}</CardTitle>
            <IntegrationStatusBadge status={status} />
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {children}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            {footer}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ============================================
// DETAIL LIST
// ============================================

export interface IntegrationDetail {
  label: string;
  value: React.ReactNode;
}

/**
 * The "here is what we're connected to" grid shown once a provider is live.
 */
export const IntegrationDetails = memo(function IntegrationDetails({
  items,
}: {
  items: IntegrationDetail[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-0.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="truncate text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
});

// ============================================
// SYNC TOGGLE
// ============================================

interface IntegrationToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}

/**
 * One switchable direction of data flow (push invoices, pull payments, ...).
 */
export const IntegrationToggle = memo(function IntegrationToggle({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: IntegrationToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children ?? (
        <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
      )}
    </div>
  );
});
