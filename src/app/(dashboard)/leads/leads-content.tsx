'use client';

/**
 * Leads Page Content
 *
 * Client component for managing leads from Pipedrive.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Download } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

import {
  LeadsTable,
  LeadDetailDrawer,
  LeadFilters,
  ConvertToCustomerDialog,
  CreateLeadDialog,
} from '@/features/leads/components';
import { syncLeadsFromPipedrive } from '@/features/pipedrive/actions';
import { useLeads, useLeadStats, useLeadStatusCounts } from '@/features/leads/hooks';
import type { Lead, LeadListItem, LeadStatus, LeadSource, LeadListParams } from '@/features/leads/types';

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// LEADS PAGE CONTENT
// ============================================

export function LeadsPageContent() {
  const router = useRouter();

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadToConvert, setLeadToConvert] = useState<Lead | LeadListItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Memoize params to prevent unnecessary re-renders
  const params: LeadListParams = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    source: sourceFilter !== 'all' ? sourceFilter : undefined,
    page,
    limit: pageSize,
  }), [statusFilter, sourceFilter, page, pageSize]);

  const { data: leads, meta, isLoading, refetch } = useLeads(params);
  const { data: stats, refetch: refetchStats } = useLeadStats();
  const { data: statusCounts, refetch: refetchStatusCounts } = useLeadStatusCounts();

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleStatusChange = (status: LeadStatus | 'all') => {
    setStatusFilter(status);
  };

  const handleSourceChange = (source: LeadSource | 'all') => {
    setSourceFilter(source);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setSourceFilter('all');
  };

  const handleRowClick = (lead: LeadListItem) => {
    setSelectedLeadId(lead.id);
  };

  const handleDrawerClose = () => {
    setSelectedLeadId(null);
  };

  const handleConvertClick = (lead: Lead | LeadListItem) => {
    setLeadToConvert(lead);
  };

  const handleConvertClose = () => {
    setLeadToConvert(null);
  };

  const handleConvertSuccess = useCallback(
    (customerId: string) => {
      refetch();
      refetchStats();
      refetchStatusCounts();
      setSelectedLeadId(null);
      // Navigate to the new customer
      router.push(`/customers?highlight=${customerId}`);
    },
    [refetch, refetchStats, refetchStatusCounts, router]
  );

  const handleDelete = useCallback(() => {
    refetch();
    refetchStats();
    refetchStatusCounts();
  }, [refetch, refetchStats, refetchStatusCounts]);

  const handleSyncFromPipedrive = async () => {
    setIsSyncing(true);
    try {
      const result = await syncLeadsFromPipedrive();
      if (result.success && result.data) {
        const { created, updated, deleted } = result.data;
        toast.success(
          `Sync complete: ${created} created, ${updated} updated, ${deleted} removed`
        );
        refetch();
        refetchStats();
        refetchStatusCounts();
      } else {
        toast.error(result.error || 'Failed to sync leads');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync leads from Pipedrive');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateSuccess = useCallback(() => {
    refetch();
    refetchStats();
    refetchStatusCounts();
  }, [refetch, refetchStats, refetchStatusCounts]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage leads synced from Pipedrive CRM
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSyncFromPipedrive}
            disabled={isSyncing}
          >
            <Download className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from Pipedrive'}
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Leads</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New This Month</CardDescription>
            <CardTitle className="text-3xl">{stats.newThisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Qualified</CardDescription>
            <CardTitle className="text-3xl">{stats.qualified}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Pipeline Value</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(stats.totalDealValue)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <LeadFilters
        status={statusFilter}
        source={sourceFilter}
        onStatusChange={handleStatusChange}
        onSourceChange={handleSourceChange}
        onClear={handleClearFilters}
        statusCounts={statusCounts}
      />

      {/* Table */}
      {leads.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leads yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Leads will appear here once you sync from Pipedrive or add them manually.
              Click &quot;Sync from Pipedrive&quot; to import your leads.
            </p>
            <Button
              variant="outline"
              onClick={handleSyncFromPipedrive}
              disabled={isSyncing}
            >
              <Download className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync from Pipedrive'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <LeadsTable
          data={leads}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          onConvert={handleConvertClick}
          onDelete={handleDelete}
          pagination={{
            page: meta.page,
            pageSize: meta.limit,
            total: meta.total,
            totalPages: meta.totalPages,
            onPageChange: setPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setPage(1);
            },
          }}
        />
      )}

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onClose={handleDrawerClose}
        onConvert={handleConvertClick}
      />

      {/* Convert to Customer Dialog */}
      <ConvertToCustomerDialog
        lead={leadToConvert}
        open={!!leadToConvert}
        onClose={handleConvertClose}
        onSuccess={handleConvertSuccess}
      />

      {/* Create Lead Dialog */}
      <CreateLeadDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
