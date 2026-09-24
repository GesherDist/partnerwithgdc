'use client';

/**
 * OrderPipeline Component
 *
 * Visual funnel/pipeline showing order flow:
 * Quotes → Sales Orders → Purchase Orders → Shipments
 */

import { FileText, ShoppingCart, Package, Truck, ArrowRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { PipelineStage } from '../types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStageIcon(id: string) {
  const iconMap: Record<string, typeof FileText> = {
    quotes: FileText,
    'sales-orders': ShoppingCart,
    'purchase-orders': Package,
    shipments: Truck,
  };
  return iconMap[id] || FileText;
}

function getStageColor(status: 'active' | 'completed' | 'pending'): string {
  switch (status) {
    case 'active':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-emerald-500';
    case 'pending':
      return 'bg-amber-500';
    default:
      return 'bg-gray-500';
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// PIPELINE STAGE COMPONENT
// ============================================

interface PipelineStageCardProps {
  stage: PipelineStage;
  isLast: boolean;
}

function PipelineStageCard({ stage, isLast }: PipelineStageCardProps) {
  const Icon = getStageIcon(stage.id);
  const colorClass = getStageColor(stage.status);

  return (
    <div className="flex items-center">
      <div className="flex-1 relative">
        <div className="flex flex-col items-center p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors">
          <div className={`rounded-full p-3 ${colorClass} text-white mb-2`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-2xl font-bold">{stage.count}</span>
          <span className="text-xs text-muted-foreground font-medium">
            {stage.name}
          </span>
          <span className="text-sm font-semibold text-primary mt-1">
            {formatCurrency(stage.value)}
          </span>
        </div>
      </div>
      {!isLast && (
        <div className="px-2 hidden md:block">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface OrderPipelineProps {
  stages: PipelineStage[];
}

export function OrderPipeline({ stages }: OrderPipelineProps) {
  const totalValue = stages.reduce((sum, stage) => sum + stage.value, 0);
  const totalCount = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Order Pipeline</CardTitle>
            <CardDescription>
              {totalCount} orders in pipeline | {formatCurrency(totalValue)} total value
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-0">
          {stages.map((stage, index) => (
            <PipelineStageCard
              key={stage.id}
              stage={stage}
              isLast={index === stages.length - 1}
            />
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Pipeline Progress</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            {stages.map((stage, index) => {
              const widthPercent = (stage.value / totalValue) * 100;
              return (
                <div
                  key={stage.id}
                  className={`h-full ${getStageColor(stage.status)} ${
                    index === 0 ? 'rounded-l-full' : ''
                  } ${index === stages.length - 1 ? 'rounded-r-full' : ''}`}
                  style={{ width: `${widthPercent}%` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            {stages.map((stage) => (
              <span key={stage.id}>
                {stage.name}: {((stage.value / totalValue) * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
