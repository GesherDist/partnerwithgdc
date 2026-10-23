'use client';

/**
 * CustomerMappingDialog
 *
 * One-time, by-hand mapping of ERP customers to Pipedrive organizations
 * (gdc/customer-mapping.service), e.g. right after connecting the live
 * Pipedrive account and before the first "Sync all with Pipedrive".
 *
 * Loading the preview writes nothing. Each row shows the suggested
 * organization and why; the user confirms or changes it (Link to an
 * organization, Create new, Skip). Rows left undecided are not changed.
 * "Apply mapping" runs in batches and shows the result per row.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, GitMerge, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { applyCustomerMappingAction, getCustomerMappingPreviewAction } from '@/features/pipedrive/gdc/actions';
import type {
  CustomerMappingPreview,
  MappingAction,
  MappingApplyResult,
  MappingOrganization,
  MappingReason,
  MappingRow,
} from '@/features/pipedrive/gdc/customer-mapping.service';

/** Same as MAPPING_APPLY_BATCH_SIZE on the server */
const BATCH_SIZE = 20;

const REASON_LABELS: Record<MappingReason, { label: string; className: string }> = {
  linked: { label: 'Already linked', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  erp_id: { label: 'ERP ID', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  exact_name: { label: 'Same name', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  email: { label: 'Email', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  similar: { label: 'Similar name', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  none: { label: 'Not found', className: 'bg-red-100 text-red-800 border-red-200' },
};

type Choice = { action: MappingAction | null; orgId: number | null };
type Filter = 'all' | 'review' | 'link' | 'create' | 'skip';

function initialChoices(rows: MappingRow[]): Map<string, Choice> {
  return new Map(
    rows.map((row) => [
      row.customerId,
      {
        action: row.defaultAction,
        orgId: row.defaultAction === 'link' ? row.suggestion?.orgId ?? null : null,
      },
    ])
  );
}

export function CustomerMappingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [preview, setPreview] = useState<CustomerMappingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<Map<string, Choice>>(new Map());
  const [filter, setFilter] = useState<Filter>('review');
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Map<string, MappingApplyResult>>(new Map());

  const orgById = useMemo(() => new Map((preview?.organizations ?? []).map((org) => [org.id, org])), [preview]);

  const load = async () => {
    setLoading(true);
    setResults(new Map());
    try {
      const result = await getCustomerMappingPreviewAction();
      if (!result.success || !result.data) {
        toast.error('Could not load the mapping', { description: result.error || 'Unknown error' });
        return;
      }
      setPreview(result.data);
      setChoices(initialChoices(result.data.rows));
      if (!result.data.complete) {
        toast.warning('Pipedrive did not return every organization or person; some suggestions may be missing');
      }
    } finally {
      setLoading(false);
    }
  };

  const setChoice = (customerId: string, choice: Choice) => {
    setChoices((current) => new Map(current).set(customerId, choice));
  };

  // Organizations chosen for more than one customer
  const duplicateOrgs = useMemo(() => {
    const counts = new Map<number, number>();
    for (const choice of choices.values()) {
      if (choice.action === 'link' && choice.orgId) {counts.set(choice.orgId, (counts.get(choice.orgId) ?? 0) + 1);}
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [choices]);

  const needsReview = (row: MappingRow) => {
    const choice = choices.get(row.customerId);
    return !choice?.action || row.reason === 'similar' || Boolean(row.note) || (choice.orgId !== null && duplicateOrgs.has(choice.orgId));
  };

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (preview?.rows ?? []).filter((row) => {
      const choice = choices.get(row.customerId);
      if (term && !`${row.customerCode} ${row.name} ${row.email ?? ''}`.toLowerCase().includes(term)) {return false;}
      if (filter === 'review') {return needsReview(row);}
      if (filter === 'all') {return true;}
      return choice?.action === filter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, choices, filter, search, duplicateOrgs]);

  const counts = useMemo(() => {
    const c = { link: 0, create: 0, skip: 0, undecided: 0, review: 0 };
    for (const row of preview?.rows ?? []) {
      const action = choices.get(row.customerId)?.action;
      if (action) {c[action]++;} else {c.undecided++;}
      if (needsReview(row)) {c.review++;}
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, choices, duplicateOrgs]);

  const missingOrg = useMemo(
    () => [...choices.values()].filter((c) => c.action === 'link' && !c.orgId).length,
    [choices]
  );

  const apply = async () => {
    setConfirmOpen(false);
    if (!preview) {return;}
    const decisions = preview.rows
      .map((row) => ({ row, choice: choices.get(row.customerId) }))
      .filter(({ choice }) => choice?.action && (choice.action !== 'link' || choice.orgId))
      .map(({ row, choice }) => ({ customerId: row.customerId, action: choice!.action!, orgId: choice!.orgId }));

    setProgress({ done: 0, total: decisions.length });
    const collected = new Map<string, MappingApplyResult>();
    try {
      for (let start = 0; start < decisions.length; start += BATCH_SIZE) {
        const batch = decisions.slice(start, start + BATCH_SIZE);
        const result = await applyCustomerMappingAction(batch);
        if (!result.success || !result.data) {
          toast.error('Mapping stopped', { description: `${result.error || 'Unknown error'} (${start} of ${decisions.length} applied)` });
          break;
        }
        for (const r of result.data) {collected.set(r.customerId, r);}
        setResults(new Map(collected));
        setProgress({ done: Math.min(start + BATCH_SIZE, decisions.length), total: decisions.length });
      }
      const all = [...collected.values()];
      const errors = all.filter((r) => r.status === 'error').length;
      const summary = ['linked', 'created', 'skipped', 'unchanged']
        .map((status) => `${all.filter((r) => r.status === status).length} ${status}`)
        .join(' · ');
      if (errors > 0) {
        toast.warning(`Mapping applied with ${errors} error(s)`, { description: summary });
        setFilter('all');
      } else {
        toast.success('Mapping applied', { description: `${summary}. Next: "Sync all with Pipedrive" on the Customers page.` });
      }
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !progress && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-7xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Pipedrive customer mapping</DialogTitle>
          <DialogDescription>
            Link each Gesher customer to its Pipedrive organization once. Loading the list changes nothing. Applying
            stores the links and writes the ERP Customer ID on each organization (names and addresses are not
            changed). Undecided rows are left as they are. Run &quot;Sync all with Pipedrive&quot; afterwards.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitMerge className="mr-2 h-4 w-4" />}
              Load customers and suggestions
            </Button>
            <p className="text-xs text-muted-foreground">Reads every Pipedrive organization and person. Nothing is written.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56"
              />
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="h-9 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="review">Needs review ({counts.review})</SelectItem>
                  <SelectItem value="all">All ({preview.rows.length})</SelectItem>
                  <SelectItem value="link">Link ({counts.link})</SelectItem>
                  <SelectItem value="create">Create new ({counts.create})</SelectItem>
                  <SelectItem value="skip">Skip ({counts.skip})</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={load} disabled={loading || Boolean(progress)}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Reload
              </Button>
              <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {counts.link} link · {counts.create} create · {counts.skip} skip · {counts.undecided} undecided
                </span>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={Boolean(progress) || duplicateOrgs.size > 0 || missingOrg > 0}
                >
                  {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {progress ? `Applying ${progress.done} / ${progress.total}…` : 'Apply mapping'}
                </Button>
              </div>
            </div>
            {(duplicateOrgs.size > 0 || missingOrg > 0) && (
              <p className="text-xs text-red-600">
                {duplicateOrgs.size > 0 && `${duplicateOrgs.size} organization(s) are chosen for more than one customer. `}
                {missingOrg > 0 && `${missingOrg} row(s) are set to Link without an organization.`}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Gesher customer</th>
                    <th className="px-3 py-2">Suggestion</th>
                    <th className="px-3 py-2">Pipedrive organization</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const choice = choices.get(row.customerId) ?? { action: null, orgId: null };
                    const result = results.get(row.customerId);
                    const reason = REASON_LABELS[row.reason];
                    const duplicate = choice.orgId !== null && duplicateOrgs.has(choice.orgId);
                    return (
                      <tr key={row.customerId} className="border-t align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.customerCode}
                            {row.email ? ` · ${row.email}` : ''}
                            {row.status !== 'active' ? ` · ${row.status}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={reason.className}>
                            {reason.label}
                            {row.suggestion?.score && row.reason === 'similar' ? ` ${Math.round(row.suggestion.score * 100)}%` : ''}
                          </Badge>
                          {row.note && <div className="mt-1 max-w-xs text-xs text-amber-700">{row.note}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <OrganizationPicker
                            row={row}
                            organizations={preview.organizations}
                            orgById={orgById}
                            value={choice.orgId}
                            invalid={duplicate}
                            disabled={Boolean(progress)}
                            onChange={(orgId) => setChoice(row.customerId, { action: 'link', orgId })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={choice.action ?? 'undecided'}
                            disabled={Boolean(progress)}
                            onValueChange={(value) =>
                              setChoice(row.customerId, {
                                action: value === 'undecided' ? null : (value as MappingAction),
                                orgId: value === 'link' ? choice.orgId ?? row.suggestion?.orgId ?? null : null,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="undecided">— Decide —</SelectItem>
                              <SelectItem value="link">Link</SelectItem>
                              <SelectItem value="create">Create new</SelectItem>
                              <SelectItem value="skip">Skip</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {result && (
                            <span className={result.status === 'error' ? 'text-red-600' : 'text-emerald-700'}>
                              {result.message}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No customers in this view
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply the customer mapping?</AlertDialogTitle>
              <AlertDialogDescription>
                {counts.link} customer(s) will be linked to the chosen organization, {counts.create} organization(s)
                created in Pipedrive, and {counts.skip} customer(s) unlinked. {counts.undecided} undecided customer(s)
                stay as they are. Changing a customer&apos;s organization also clears its old contact links; &quot;Sync
                all with Pipedrive&quot; pairs the contacts again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={apply}>Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// ORGANIZATION PICKER
// ============================================

function orgLabel(org: MappingOrganization): string {
  return [org.name, org.city].filter(Boolean).join(' · ');
}

function OrganizationPicker({
  row,
  organizations,
  orgById,
  value,
  invalid,
  disabled,
  onChange,
}: {
  row: MappingRow;
  organizations: MappingOrganization[];
  orgById: Map<number, MappingOrganization>;
  value: number | null;
  invalid: boolean;
  disabled: boolean;
  onChange: (orgId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const selected = value ? orgById.get(value) : undefined;

  const suggested = [row.suggestion, ...row.alternatives]
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ candidate: c, org: orgById.get(c.orgId) }))
    .filter((x): x is { candidate: typeof x.candidate; org: MappingOrganization } => Boolean(x.org));

  const matches = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) {return [];}
    return organizations
      .filter((org) => `${org.name} ${org.city ?? ''} ${org.erpCustomerId ?? ''} ${org.id}`.toLowerCase().includes(t))
      .slice(0, 50);
  }, [organizations, term]);

  const pick = (orgId: number) => {
    onChange(orgId);
    setOpen(false);
    setTerm('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={`h-8 w-72 justify-between font-normal ${invalid ? 'border-red-500 text-red-600' : ''}`}
        >
          <span className="truncate">{selected ? orgLabel(selected) : 'Choose organization…'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search Pipedrive organizations…" value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>{term ? 'No organization found' : 'Type to search all organizations'}</CommandEmpty>
            {!term && suggested.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggested.map(({ candidate, org }) => (
                  <CommandItem key={`s-${org.id}`} value={`s-${org.id}`} onSelect={() => pick(org.id)}>
                    <Check className={`mr-2 h-4 w-4 ${value === org.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">{orgLabel(org)}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">
                      {REASON_LABELS[candidate.reason].label}
                      {candidate.score ? ` ${Math.round(candidate.score * 100)}%` : ''}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {matches.length > 0 && (
              <CommandGroup heading="All organizations">
                {matches.map((org) => (
                  <CommandItem key={org.id} value={String(org.id)} onSelect={() => pick(org.id)}>
                    <Check className={`mr-2 h-4 w-4 ${value === org.id ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="truncate">{orgLabel(org)}</span>
                    {org.erpCustomerId && <span className="ml-auto pl-2 text-xs text-muted-foreground">{org.erpCustomerId}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
