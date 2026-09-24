'use client';

/**
 * LeadFilters Component
 *
 * Filter controls for the leads list.
 */

import { X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import type { LeadStatus, LeadSource } from '../types';

// ============================================
// TYPES
// ============================================

interface LeadFiltersProps {
  status: LeadStatus | 'all';
  source: LeadSource | 'all';
  onStatusChange: (status: LeadStatus | 'all') => void;
  onSourceChange: (source: LeadSource | 'all') => void;
  onClear: () => void;
  statusCounts?: Record<LeadStatus, number>;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_OPTIONS: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

const SOURCE_OPTIONS: { value: LeadSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'pipedrive', label: 'Pipedrive' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

// ============================================
// COMPONENT
// ============================================

export function LeadFilters({
  status,
  source,
  onStatusChange,
  onSourceChange,
  onClear,
  statusCounts,
}: LeadFiltersProps) {
  const hasFilters = status !== 'all' || source !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Filter */}
      <Select value={status} onValueChange={(v) => onStatusChange(v as LeadStatus | 'all')}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center justify-between gap-2">
                <span>{option.label}</span>
                {statusCounts && option.value !== 'all' && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {statusCounts[option.value as LeadStatus] || 0}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Source Filter */}
      <Select value={source} onValueChange={(v) => onSourceChange(v as LeadSource | 'all')}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
