'use client';

/**
 * Settings > Dashboard Targets (Nov 7 2026)
 *
 * Monthly revenue target and margin target used by the dashboard (Revenue card,
 * Revenue Trend, Blended Margin card, Margin Analysis). QuickBooks has no budget
 * for Gesher, so they are set here. Editing needs settings.edit.
 */

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { getDashboardTargetsSettings, updateDashboardTargets } from '../actions/dashboard-targets.actions';

interface Loaded {
  monthlyRevenueTarget: number;
  marginTargetPct: number;
  updatedAt: string | null;
  updatedByName: string | null;
  canEdit: boolean;
}

export function DashboardTargetsSettings() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revenue, setRevenue] = useState('');
  const [margin, setMargin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getDashboardTargetsSettings().then((result) => {
      if (!active) {
        return;
      }
      if (!result.success) {
        setLoadError(result.error);
        return;
      }
      setLoaded(result.data);
      setRevenue(String(result.data.monthlyRevenueTarget));
      setMargin(String(result.data.marginTargetPct));
    });
    return () => {
      active = false;
    };
  }, []);

  const revenueNumber = Number(revenue);
  const marginNumber = Number(margin);
  const revenueValid = revenue.trim() !== '' && Number.isFinite(revenueNumber) && revenueNumber >= 0;
  const marginValid = margin.trim() !== '' && Number.isFinite(marginNumber) && marginNumber >= 0 && marginNumber <= 100;
  const changed = loaded !== null && (revenueNumber !== loaded.monthlyRevenueTarget || marginNumber !== loaded.marginTargetPct);

  const handleSave = async () => {
    if (!revenueValid || !marginValid) {
      return;
    }
    setSaving(true);
    const result = await updateDashboardTargets({ monthlyRevenueTarget: revenueNumber, marginTargetPct: marginNumber });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setLoaded((prev) => (prev ? { ...prev, ...result.data } : prev));
    setRevenue(String(result.data.monthlyRevenueTarget));
    setMargin(String(result.data.marginTargetPct));
    toast.success('Dashboard targets saved');
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Dashboard Targets</h2>
        <p className="text-sm text-muted-foreground">
          Targets shown on the dashboard. QuickBooks has no budget, so they are set here.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Revenue and Margin Targets</CardTitle>
          </div>
          <CardDescription>
            Used by the Revenue card, Revenue Trend chart, Blended Margin card and Margin Analysis chart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : !loaded ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="monthly-revenue-target">Monthly Revenue Target ($)</Label>
                  <Input
                    id="monthly-revenue-target"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1000}
                    value={revenue}
                    disabled={!loaded.canEdit || saving}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                  {!revenueValid && <p className="text-xs text-destructive">Enter an amount of 0 or more</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="margin-target">Margin Target (%)</Label>
                  <Input
                    id="margin-target"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.5}
                    value={margin}
                    disabled={!loaded.canEdit || saving}
                    onChange={(e) => setMargin(e.target.value)}
                  />
                  {!marginValid && <p className="text-xs text-destructive">Enter a percentage from 0 to 100</p>}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {loaded.updatedAt
                    ? `Last saved ${format(new Date(loaded.updatedAt), 'MMM d, yyyy h:mm a')}${loaded.updatedByName ? ` by ${loaded.updatedByName}` : ''}`
                    : // Before Nov 9 2026: 'Default values ($220,000 / 30%), not saved yet'
                      'Default values ($400,000 / 18%), not saved yet'}
                  {!loaded.canEdit && ' · You can view these targets; editing needs the Settings edit permission'}
                </p>
                {loaded.canEdit && (
                  <Button onClick={handleSave} disabled={saving || !changed || !revenueValid || !marginValid}>
                    {saving ? 'Saving…' : 'Save Targets'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
