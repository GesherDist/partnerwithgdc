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
import { Truck, Pencil, Clock, AlertTriangle, Eye } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
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

  const toggleAddressExpand = (id: string) => {
    setExpandedAddressId(expandedAddressId === id ? null : id);
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotesId(expandedNotesId === id ? null : id);
  };

  // Sort by priority: LFD critical > LFD approaching > Delayed > Overdue > This week
  const sortedItems = [...items].sort((a, b) => {
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
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Load #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>ETA Port</TableHead>
                <TableHead>LFD</TableHead>
                <TableHead>Customer ETA/Due</TableHead>
                <TableHead>Delivery Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action Required / Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length > 0 ? (
                sortedItems.map((item) => {
                  // Determine row background color based on priority
                  // LFD Critical (red) > LFD Approaching (orange) > Delayed (yellow) > Overdue (red) > This Week (amber)
                  let rowClassName = '';
                  if (item.isLFDCritical) {
                    rowClassName = 'bg-red-100 hover:bg-red-200 border-l-4 border-l-red-500';
                  } else if (item.isLFDApproaching) {
                    rowClassName = 'bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500';
                  } else if (item.isDelayed) {
                    rowClassName = 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500';
                  } else if (item.isOverdue) {
                    rowClassName = 'bg-red-50 hover:bg-red-100';
                  } else if (item.isThisWeek) {
                    rowClassName = 'bg-amber-50 hover:bg-amber-100';
                  }

                  return (
                    <TableRow key={item.id} className={rowClassName}>
                      <TableCell className="font-medium">{item.loadNumber}</TableCell>
                      <TableCell>{item.customer}</TableCell>
                      <TableCell>{item.po}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
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
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No shipments require immediate attention
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
