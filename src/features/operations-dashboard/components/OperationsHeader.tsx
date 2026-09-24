'use client';

/**
 * Operations Header Component
 *
 * Page header for the operations dashboard with refresh and export actions.
 */

import { RefreshCw, Calendar, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

// ============================================
// TYPES
// ============================================

export type ExportOption =
  | 'executive-summary'
  | 'shipment-overview'
  | 'supplier-schedule'
  | 'gdc1-inventory'
  | 'all'
  | 'pdf';

interface OperationsHeaderProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  onExport?: (type: ExportOption) => void;
  isRefreshing?: boolean;
  isExporting?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OperationsHeader({
  lastUpdated,
  onRefresh,
  onExport,
  isRefreshing = false,
  isExporting = false,
}: OperationsHeaderProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Operations Dashboard
        </h1>
        <p className="text-muted-foreground">
          Supplier & GDC Inventory & Shipments
        </p>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Last updated: {formatDate(lastUpdated)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              {isExporting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? 'Exporting...' : 'Export'}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onExport?.('pdf')}>
              <FileText className="h-4 w-4 mr-2 text-red-600" />
              Download PDF Report
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport?.('executive-summary')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Executive Summary (Excel)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.('shipment-overview')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Shipment Overview (Excel)
            </DropdownMenuItem>
            {/* HIDDEN: Supplier Schedule export - per Ankur/Jenny feedback Aug 26, 2025 */}
            {/* <DropdownMenuItem onClick={() => onExport?.('supplier-schedule')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Supplier Schedule (Excel)
            </DropdownMenuItem> */}
            <DropdownMenuItem onClick={() => onExport?.('gdc1-inventory')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              GDC 1 Inventory (Excel)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport?.('all')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Full Report (Excel)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
