'use client';

/**
 * Immediate Attention Table Component
 *
 * Shows shipments that need immediate attention:
 * - In Transit items
 * - Items delivering in next 7 days
 * - Overdue items highlighted in red
 */

import { useState } from 'react';
import { Truck, Pencil, Clock, AlertTriangle, Eye, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { ImmediateAttentionItem } from '../types';
import { StatusBadge } from '../lib/status-badge';

// ============================================
// TYPES
// ============================================

interface ImmediateAttentionTableProps {
  items: ImmediateAttentionItem[];
  onViewDetails?: (item: ImmediateAttentionItem) => void;
  onAddNote?: (item: ImmediateAttentionItem) => void;
  onEdit?: (item: ImmediateAttentionItem) => void;
  onRefresh?: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ImmediateAttentionTable({
  items,
  onViewDetails,
  onAddNote: _onAddNote,
  onEdit,
  onRefresh: _onRefresh,
}: ImmediateAttentionTableProps) {
  // State for expanded addresses and notes
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting state
  type SortColumn = 'loadNumber' | 'customer' | 'po' | 'qty' | 'etaPort' | 'customerEtaDue' | 'status';
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleAddressExpand = (id: string) => {
    setExpandedAddressId(expandedAddressId === id ? null : id);
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotesId(expandedNotesId === id ? null : id);
  };

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to asc
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort items - if user selected a column, use that; otherwise use priority sort
  const sortedItems = [...items].sort((a, b) => {
    // If user has selected a column to sort by, use that
    if (sortColumn) {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'loadNumber':
          aVal = a.loadNumber;
          bVal = b.loadNumber;
          break;
        case 'customer':
          aVal = a.customer;
          bVal = b.customer;
          break;
        case 'po':
          aVal = a.po;
          bVal = b.po;
          break;
        case 'qty':
          aVal = a.qty;
          bVal = b.qty;
          break;
        case 'etaPort':
          aVal = a.etaPort ? new Date(a.etaPort).getTime() : 0;
          bVal = b.etaPort ? new Date(b.etaPort).getTime() : 0;
          break;
        case 'customerEtaDue':
          aVal = a.customerEtaDue ? new Date(a.customerEtaDue).getTime() : 0;
          bVal = b.customerEtaDue ? new Date(b.customerEtaDue).getTime() : 0;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    // Default priority sort: LFD critical > LFD approaching > Delayed > Overdue > This week
    // LFD Critical items first (highest priority)
    if (a.isLFDCritical && !b.isLFDCritical) return -1;
    if (!a.isLFDCritical && b.isLFDCritical) return 1;
    // LFD Approaching items next
    if (a.isLFDApproaching && !b.isLFDApproaching) return -1;
    if (!a.isLFDApproaching && b.isLFDApproaching) return 1;
    // Delayed items next
    if (a.isDelayed && !b.isDelayed) return -1;
    if (!a.isDelayed && b.isDelayed) return 1;
    // Then overdue items
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    // Then this week items
    if (a.isThisWeek && !b.isThisWeek) return -1;
    if (!a.isThisWeek && b.isThisWeek) return 1;
    return 0;
  });

  // Pagination calculations
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = sortedItems.slice(startIndex, endIndex);

  const overdueCount = items.filter(i => i.isOverdue).length;
  const thisWeekCount = items.filter(i => i.isThisWeek).length;
  const lfdCriticalCount = items.filter(i => i.isLFDCritical).length;
  const lfdApproachingCount = items.filter(i => i.isLFDApproaching).length;
  const delayedCount = items.filter(i => i.isDelayed).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-red-600" />
              Immediate Attention - In Transit / Next 7 Days
            </CardTitle>
            <CardDescription>
              {items.length} shipments requiring attention
              {lfdCriticalCount > 0 && (
                <span className="text-red-600 font-medium ml-1">
                  ({lfdCriticalCount} LFD Critical!)
                </span>
              )}
              {lfdApproachingCount > 0 && (
                <span className="text-orange-600 ml-1">
                  ({lfdApproachingCount} LFD Soon)
                </span>
              )}
              {delayedCount > 0 && (
                <span className="text-amber-600 font-medium ml-1">
                  ({delayedCount} Delayed!)
                </span>
              )}
              {overdueCount > 0 && (
                <span className="text-red-600 ml-1">
                  ({overdueCount} overdue)
                </span>
              )}
              {thisWeekCount > 0 && (
                <span className="text-amber-600 ml-1">
                  ({thisWeekCount} this week)
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-30 bg-muted w-[140px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                  <button
                    onClick={() => handleSort('loadNumber')}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    Load #
                    {sortColumn === 'loadNumber' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10 w-[160px]">
                  <button
                    onClick={() => handleSort('customer')}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    Customer
                    {sortColumn === 'customer' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10 w-[100px]">
                  <button
                    onClick={() => handleSort('po')}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    PO
                    {sortColumn === 'po' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10 text-right w-[80px]">
                  <button
                    onClick={() => handleSort('qty')}
                    className="flex items-center gap-1 hover:text-primary ml-auto"
                  >
                    Qty
                    {sortColumn === 'qty' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10 w-[100px]">
                  <button
                    onClick={() => handleSort('etaPort')}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    ETA Port
                    {sortColumn === 'etaPort' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10 w-[100px]">LFD</TableHead>
                <TableHead className="relative z-10">
                  <button
                    onClick={() => handleSort('customerEtaDue')}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    Customer ETA/Due
                    {sortColumn === 'customerEtaDue' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10">Delivery Address</TableHead>
                <TableHead className="relative z-10">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    Status
                    {sortColumn === 'status' ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="relative z-10 w-[140px]">Last Updated</TableHead>
                <TableHead className="relative z-10">Fulfillment Source</TableHead>
                <TableHead className="relative z-10">Allocated To</TableHead>
                <TableHead className="relative z-10">Action Required / Notes</TableHead>
                <TableHead className="relative z-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => {
                  // Determine row background color based on priority
                  // LFD Critical (red) > LFD Approaching (orange) > Delayed (yellow) > Overdue (red) > This Week (amber)
                  let rowClassName = '';
                  let cellBgClass = 'bg-white'; // default white background

                  if (item.isLFDCritical) {
                    rowClassName = 'bg-red-100 hover:bg-red-200 border-l-4 border-l-red-500';
                    cellBgClass = 'bg-red-100';
                  } else if (item.isLFDApproaching) {
                    rowClassName = 'bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500';
                    cellBgClass = 'bg-orange-50';
                  } else if (item.isDelayed) {
                    rowClassName = 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500';
                    cellBgClass = 'bg-yellow-50';
                  } else if (item.isOverdue) {
                    rowClassName = 'bg-red-50 hover:bg-red-100';
                    cellBgClass = 'bg-red-50';
                  } else if (item.isThisWeek) {
                    rowClassName = 'bg-amber-50 hover:bg-amber-100';
                    cellBgClass = 'bg-amber-50';
                  }

                  return (
                    <TableRow key={item.id} className={rowClassName}>
                      <TableCell className={`sticky left-0 z-20 w-[140px] font-mono text-sm font-semibold text-primary whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${cellBgClass}`}>
                        {item.loadNumber}
                      </TableCell>
                      <TableCell className="w-[160px] font-medium">
                        {item.customer}
                      </TableCell>
                      <TableCell className="w-[100px]">{item.po}</TableCell>
                      <TableCell className="text-right w-[80px]">{item.qty}</TableCell>
                      <TableCell>{formatDate(item.etaPort)}</TableCell>
                      <TableCell>
                        {item.lfdDate ? (
                          <div className="flex items-center gap-1">
                            {item.isLFDCritical && (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            )}
                            {item.isLFDApproaching && !item.isLFDCritical && (
                              <Clock className="h-4 w-4 text-orange-500" />
                            )}
                            <span className={
                              item.isLFDCritical
                                ? 'text-red-700 font-semibold'
                                : item.isLFDApproaching
                                ? 'text-orange-600 font-medium'
                                : ''
                            }>
                              {formatDate(item.lfdDate)}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatDate(item.customerEtaDue)}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {item.deliveryAddress ? (
                          expandedAddressId === item.id ? (
                            <div className="text-sm">
                              <span>{item.deliveryAddress}</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <span className="truncate">{item.deliveryAddress.substring(0, 20)}</span>
                              <button
                                className="text-primary hover:underline text-xs ml-1 flex-shrink-0"
                                onClick={() => toggleAddressExpand(item.id)}
                              >
                                ...
                              </button>
                            </div>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} isOverdue={item.isOverdue} isDelayed={item.isDelayed} /></TableCell>
                      <TableCell className="w-[140px]">
                        {item.lastUpdated ? (
                          <div className="text-sm">
                            <div className="font-medium">{formatDateTime(item.lastUpdated)}</div>
                            {item.lastUpdatedSource && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {item.lastUpdatedSource === 'CMA CGM API' ? 'API' : 'Email'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.fulfillmentSource ? (
                          <Badge variant="outline" className="text-xs">
                            {item.fulfillmentSource === 'gdc_inventory' && 'GDC Inv.'}
                            {item.fulfillmentSource === 'platinum_dealer_inventory' && 'Dealer Inv.'}
                            {item.fulfillmentSource === 'platinum_dealer_fulfillment' && 'Dealer Fulfill.'}
                            {item.fulfillmentSource === 'direct' && 'Direct'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.allocatedToDealerName ? (
                          <div>
                            <div className="text-sm font-medium">{item.allocatedToDealerName}</div>
                            {item.allocatedToDealerLocation && (
                              <div className="text-xs text-muted-foreground">{item.allocatedToDealerLocation}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {item.actionRequired ? (
                          expandedNotesId === item.id ? (
                            <div className="text-sm">
                              <span>{item.actionRequired}</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <span className="truncate">{item.actionRequired.substring(0, 20)}</span>
                              {item.actionRequired.length > 20 && (
                                <button
                                  className="text-primary hover:underline text-xs ml-1 flex-shrink-0"
                                  onClick={() => toggleNotesExpand(item.id)}
                                >
                                  ...
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onViewDetails?.(item)}
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEdit?.(item)}
                            title="Edit Status"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    No shipments require immediate attention
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex-1 text-sm text-muted-foreground">
              Showing {startIndex + 1} to{' '}
              {Math.min(endIndex, totalItems)} of{' '}
              {totalItems} results
            </div>
            <div className="flex items-center space-x-6">
              {/* Page Size Selector */}
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1); // Reset to first page when changing page size
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
