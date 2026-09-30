'use client';

import { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/shared/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Download, ChevronLeft, ChevronRight, Eye, Calendar as CalendarIcon, X, Filter } from 'lucide-react';
import { useAuditLogs } from '@/features/audit-logs/hooks';
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_MODULE_OPTIONS,
  type AuditAction,
  type AuditLog,
  type AuditLogListParams,
} from '@/features/audit-logs/types';
import { format } from 'date-fns';
import { cn } from '@/shared/lib/utils';

// ============================================
// ACTION COLORS
// ============================================

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  restore: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  login: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  password_change: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  password_reset: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  role_assign: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  permission_grant: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  permission_revoke: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  export: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  import: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  approve: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  reject: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
};

// ============================================
// ROWS PER PAGE OPTIONS
// ============================================

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// ============================================
// COMPONENT
// ============================================

export function AuditLogsContent() {
  // Filter state
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);

  // Detail dialog state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Build params
  const params = useMemo<AuditLogListParams>(() => ({
    page,
    limit: rowsPerPage,
    search: search || undefined,
    action: selectedAction !== 'all' ? (selectedAction as AuditAction) : undefined,
    module: selectedModule !== 'all' ? selectedModule : undefined,
    dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
    dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
  }), [page, rowsPerPage, search, selectedAction, selectedModule, dateFrom, dateTo]);

  // Fetch data
  const { data: auditLogs, meta, isLoading, error } = useAuditLogs(params);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((value: string) => {
    setSelectedAction(value);
    setPage(1);
  }, []);

  const handleModuleChange = useCallback((value: string) => {
    setSelectedModule(value);
    setPage(1);
  }, []);

  const handleDateFromChange = useCallback((date: Date | undefined) => {
    setDateFrom(date);
    setPage(1);
  }, []);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    setDateTo(date);
    setPage(1);
  }, []);

  const handleRowsPerPageChange = useCallback((value: string) => {
    setRowsPerPage(parseInt(value, 10));
    setPage(1);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((p) => p + 1);
  }, []);


  const handleViewDetail = useCallback((log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSelectedAction('all');
    setSelectedModule('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = search || selectedAction !== 'all' || selectedModule !== 'all' || dateFrom || dateTo;

  // Format date for display
  const formatDate = (date: Date) => {
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  };

  // Format JSON for display
  const formatJson = (data: Record<string, unknown> | null | undefined) => {
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Audit Logs"
        description="Track and monitor system activity"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Audit Logs' },
        ]}
        actions={
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Primary Filters Row */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Input
                  placeholder="Search logs..."
                  className="w-full"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <Select value={selectedAction} onValueChange={handleActionChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {AUDIT_ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedModule} onValueChange={handleModuleChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {AUDIT_MODULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(hasActiveFilters && 'border-primary')}
              >
                <Filter className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'More Filters'}
              </Button>
            </div>

            {/* Advanced Filters (Collapsible) */}
            {showFilters && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t">
                {/* Date From */}
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !dateFrom && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={handleDateFromChange}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !dateTo && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={handleDateToChange}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={handleClearFilters}
                    disabled={!hasActiveFilters}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear All Filters
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Timestamp:</span>
                  <div className="mt-1">{formatDate(selectedLog.createdAt)}</div>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Action:</span>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={actionColors[selectedLog.action] || ''}
                    >
                      {selectedLog.action}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Module:</span>
                  <div className="mt-1 capitalize">{selectedLog.module.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">User:</span>
                  <div className="mt-1">{selectedLog.userName || selectedLog.userEmail || '-'}</div>
                </div>
                {selectedLog.entityType && (
                  <div>
                    <span className="font-medium text-muted-foreground">Entity Type:</span>
                    <div className="mt-1">{selectedLog.entityType}</div>
                  </div>
                )}
                {selectedLog.entityId && (
                  <div>
                    <span className="font-medium text-muted-foreground">Entity ID:</span>
                    <div className="mt-1 font-mono text-xs">{selectedLog.entityId}</div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedLog.description && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">Description:</span>
                  <div className="text-sm mt-1">{selectedLog.description}</div>
                </div>
              )}

              {/* Changes */}
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">Changes:</span>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    {formatJson(selectedLog.changes)}
                  </pre>
                </div>
              )}

              {/* Old Data */}
              {selectedLog.oldData && Object.keys(selectedLog.oldData).length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">Previous Data:</span>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    {formatJson(selectedLog.oldData)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {selectedLog.newData && Object.keys(selectedLog.newData).length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">New Data:</span>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    {formatJson(selectedLog.newData)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">Metadata:</span>
                  <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    {formatJson(selectedLog.metadata)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-12">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && auditLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No audit logs found</p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && auditLogs.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Module
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={actionColors[log.action] || ''}
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">
                          {log.module.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.userName || log.userEmail || '-'}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-sm">
                          {log.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(log)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-4 py-4">
                {/* Left: Row info */}
                <div className="text-sm text-muted-foreground">
                  Showing {((meta.page - 1) * meta.limit) + 1} to{' '}
                  {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} results
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-6">
                  {/* Rows per page */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {ROWS_PER_PAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option.toString()}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={handlePreviousPage}
                      disabled={!meta.hasPreviousPage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </Button>

                    <div className="text-sm font-medium">
                      Page {meta.page} of {meta.totalPages}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={handleNextPage}
                      disabled={!meta.hasNextPage}
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
