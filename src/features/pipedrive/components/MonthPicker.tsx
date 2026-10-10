'use client';

/**
 * MonthPicker
 *
 * Month selector styled like the Dashboard date filter (outline button +
 * popover) instead of the browser's native month input, so it matches the
 * app theme in every browser. Value format: YYYY-MM.
 */

import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseMonth(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number);
  const now = new Date();
  return {
    year: year && Number.isInteger(year) ? year : now.getFullYear(),
    month: month && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };
}

const toValue = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable month (YYYY-MM); later months are disabled */
  max?: string;
  className?: string;
  disabled?: boolean;
}

export function MonthPicker({ value, onChange, max, className, disabled }: MonthPickerProps) {
  const selected = parseMonth(value);
  const limit = max ? parseMonth(max) : null;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.year);

  const isAfterMax = (year: number, month: number) =>
    limit !== null && (year > limit.year || (year === limit.year && month > limit.month));

  const select = (month: number) => {
    onChange(toValue(viewYear, month));
    setOpen(false);
  };

  const now = new Date();
  const thisMonth = toValue(now.getFullYear(), now.getMonth() + 1);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {setViewYear(selected.year);}
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Month"
          disabled={disabled}
          className={cn('min-w-[180px] justify-between font-normal', className)}
        >
          <span className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {MONTH_NAMES[selected.month - 1]} {selected.year}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous year"
            onClick={() => setViewYear((year) => year - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{viewYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Next year"
            disabled={limit !== null && viewYear >= limit.year}
            onClick={() => setViewYear((year) => year + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABELS.map((label, index) => {
            const month = index + 1;
            const isSelected = viewYear === selected.year && month === selected.month;
            const isCurrent = toValue(viewYear, month) === thisMonth;
            return (
              <Button
                key={label}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                disabled={isAfterMax(viewYear, month)}
                onClick={() => select(month)}
                className={cn('h-8 font-normal', isCurrent && !isSelected && 'border border-primary/40')}
              >
                {label}
              </Button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onChange(thisMonth);
              setOpen(false);
            }}
          >
            This month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
