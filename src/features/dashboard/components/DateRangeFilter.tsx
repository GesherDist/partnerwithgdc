'use client';

/**
 * DateRangeFilter Component
 *
 * Dropdown filter for selecting date ranges on the dashboard.
 * Options: This Month, Last Month, This Quarter, Last Quarter, YTD, Last Year, Custom Date
 * Custom Date shows a calendar picker on the left side.
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { DateRange as DayPickerDateRange } from 'react-day-picker';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';

import type { DateRange, DateRangePreset } from '../types';
import { DATE_RANGE_LABELS, formatDateToString } from '../types';

// ============================================
// TYPES
// ============================================

interface DateRangeFilterProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset, customRange?: DateRange) => void;
  onRefresh?: () => void;
  className?: string;
  isLoading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const PRESET_OPTIONS: DateRangePreset[] = [
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'ytd',
  'last_year',
  'last_6_months',
  'last_12_months',
];

// ============================================
// COMPONENT
// ============================================

export function DateRangeFilter({ value, onChange, onRefresh, className, isLoading }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DayPickerDateRange | undefined>();
  const [displayText, setDisplayText] = useState<string>(DATE_RANGE_LABELS[value]);

  // Update display text when value changes
  useEffect(() => {
    if (value !== 'custom') {
      setDisplayText(DATE_RANGE_LABELS[value]);
    }
  }, [value]);

  // Reset calendar view when popover closes
  useEffect(() => {
    if (!isOpen) {
      setShowCalendar(false);
    }
  }, [isOpen]);

  // Handle preset selection - apply immediately and close
  const handlePresetClick = (preset: DateRangePreset) => {
    onChange(preset);
    setDisplayText(DATE_RANGE_LABELS[preset]);
    setIsOpen(false);
  };

  // Handle Custom Date click - show calendar
  const handleCustomClick = () => {
    setShowCalendar(true);
  };

  // Handle calendar selection
  const handleCalendarSelect = (range: DayPickerDateRange | undefined) => {
    setCustomDateRange(range);
  };

  // Handle Apply button for custom date
  const handleApply = () => {
    if (customDateRange?.from && customDateRange?.to) {
      const customRange: DateRange = {
        startDate: formatDateToString(customDateRange.from),
        endDate: formatDateToString(customDateRange.to),
        preset: 'custom',
      };
      onChange('custom', customRange);
      // Update display text with custom date range
      setDisplayText(`${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d, yyyy')}`);
      setIsOpen(false);
    }
  };

  // Handle Cancel button
  const handleCancel = () => {
    setShowCalendar(false);
    setCustomDateRange(undefined);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Refresh Button */}
      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-9 w-9"
          title="Refresh data"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="min-w-[180px] justify-between font-normal"
            disabled={isLoading}
          >
            <div className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{displayText}</span>
            </div>
            {isLoading ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex">
            {/* Left side: Calendar (only shown when Custom Date is clicked) */}
            {showCalendar && (
              <div className="p-3 border-r bg-background">
                <Calendar
                  mode="range"
                  selected={customDateRange}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={2}
                  defaultMonth={new Date()}
                  showOutsideDays={true}
                  classNames={{
                    months: "flex flex-row gap-3",
                    month: "space-y-2",
                    month_caption: "flex justify-center relative items-center h-7",
                    caption_label: "text-xs font-medium",
                    nav: "flex items-center justify-between absolute inset-x-0",
                    button_previous: "absolute left-0 h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                    button_next: "absolute right-0 h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                    month_grid: "w-full border-collapse",
                    weekdays: "flex",
                    weekday: "text-muted-foreground w-7 font-normal text-[0.65rem] text-center",
                    week: "flex w-full mt-1",
                    day: "h-7 w-7 text-center text-xs p-0 relative [&_button]:h-7 [&_button]:w-7 [&_button]:text-xs",
                    range_start: "rounded-l-md bg-primary text-primary-foreground",
                    range_end: "rounded-r-md bg-primary text-primary-foreground",
                    range_middle: "bg-accent",
                    today: "bg-accent text-accent-foreground",
                    outside: "text-muted-foreground opacity-50",
                    disabled: "text-muted-foreground opacity-50",
                  }}
                />

                {/* Date inputs display */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <div className="flex-1">
                    <input
                      type="text"
                      readOnly
                      value={customDateRange?.from ? format(customDateRange.from, 'MM/dd/yyyy') : ''}
                      placeholder="Start date"
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground"
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">-</span>
                  <div className="flex-1">
                    <input
                      type="text"
                      readOnly
                      value={customDateRange?.to ? format(customDateRange.to, 'MM/dd/yyyy') : ''}
                      placeholder="End date"
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-2 mt-3">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs px-3"
                    onClick={handleApply}
                    disabled={!customDateRange?.from || !customDateRange?.to}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}

            {/* Right side: Preset options */}
            <div className="py-2 px-1 min-w-[160px]">
              {PRESET_OPTIONS.map((preset) => (
                <button
                  key={preset}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                    value === preset && !showCalendar && 'bg-accent'
                  )}
                  onClick={() => handlePresetClick(preset)}
                >
                  <span className="flex-1 text-left">{DATE_RANGE_LABELS[preset]}</span>
                  {value === preset && !showCalendar && (
                    <Check className="h-4 w-4 ml-2 text-primary" />
                  )}
                </button>
              ))}
              <div className="my-1 mx-2 h-px bg-border" />
              <button
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                  (value === 'custom' || showCalendar) && 'bg-accent'
                )}
                onClick={handleCustomClick}
              >
                <span className="flex-1 text-left">{DATE_RANGE_LABELS.custom}</span>
                {value === 'custom' && !showCalendar && (
                  <Check className="h-4 w-4 ml-2 text-primary" />
                )}
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
