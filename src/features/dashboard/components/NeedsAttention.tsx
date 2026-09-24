'use client';

/**
 * NeedsAttention Component
 *
 * Critical items requiring immediate attention.
 * Shows approvals, alerts, and action items.
 */

import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  DollarSign,
  FileCheck,
  Package,
  Truck,
  RefreshCcw,
  Clock,
  ChevronRight,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

import type { NeedsAttentionItem, AttentionCategory, AttentionPriority } from '../types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCategoryIcon(category: AttentionCategory) {
  const iconMap = {
    credit_hold: CreditCard,
    price_approval: DollarSign,
    quote_approval: FileCheck,
    stock_contention: Package,
    low_inventory: AlertTriangle,
    shipment_today: Truck,
    sync_failed: RefreshCcw,
    past_due_ar: Clock,
  };
  return iconMap[category] || AlertTriangle;
}

function getPriorityStyles(priority: AttentionPriority): {
  badge: string;
  icon: string;
  border: string;
} {
  switch (priority) {
    case 'high':
      return {
        badge: 'bg-red-100 text-red-700 border-red-200',
        icon: 'text-red-600 bg-red-100',
        border: 'border-l-red-500',
      };
    case 'medium':
      return {
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: 'text-amber-600 bg-amber-100',
        border: 'border-l-amber-500',
      };
    case 'low':
    default:
      return {
        badge: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: 'text-blue-600 bg-blue-100',
        border: 'border-l-blue-500',
      };
  }
}

// ============================================
// ATTENTION ITEM COMPONENT
// ============================================

interface AttentionItemProps {
  item: NeedsAttentionItem;
}

function AttentionItem({ item }: AttentionItemProps) {
  const Icon = getCategoryIcon(item.category);
  const styles = getPriorityStyles(item.priority);

  const content = (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border border-l-4 ${styles.border} bg-card hover:bg-muted/50 transition-colors cursor-pointer group`}
    >
      <div className={`rounded-full p-2 ${styles.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.title}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs font-semibold">
            {item.count}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        {item.assignee && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Assigned: <span className="font-medium">{item.assignee}</span>
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }

  return content;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface NeedsAttentionProps {
  items: NeedsAttentionItem[];
  maxItems?: number;
}

export function NeedsAttention({ items, maxItems = 8 }: NeedsAttentionProps) {
  // Sort by priority (high first) and take maxItems
  const sortedItems = [...items]
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, maxItems);

  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const highPriorityCount = items
    .filter((item) => item.priority === 'high')
    .reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Needs Attention
            </CardTitle>
            <CardDescription>
              {totalCount} items requiring action
              {highPriorityCount > 0 && (
                <span className="text-red-600 ml-1">
                  ({highPriorityCount} high priority)
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {sortedItems.length > 0 ? (
              sortedItems.map((item) => (
                <AttentionItem key={item.id} item={item} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full p-3 bg-emerald-100 text-emerald-600 mb-3">
                  <FileCheck className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground">No items require attention</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
