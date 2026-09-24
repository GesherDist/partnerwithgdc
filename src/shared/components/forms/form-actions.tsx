'use client';

/**
 * FormActions Component
 *
 * A component for form action buttons (submit, cancel, reset).
 */

import { type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface FormActionsProps {
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Reset button text */
  resetText?: string;
  /** Show cancel button */
  showCancel?: boolean;
  /** Show reset button */
  showReset?: boolean;
  /** Cancel handler */
  onCancel?: () => void;
  /** Reset handler */
  onReset?: () => void;
  /** Additional content before buttons */
  children?: ReactNode;
  /** Additional class names */
  className?: string;
  /** Button alignment */
  align?: 'left' | 'center' | 'right' | 'between';
}

export function FormActions({
  isSubmitting = false,
  disabled = false,
  submitText = 'Save',
  cancelText = 'Cancel',
  resetText = 'Reset',
  showCancel = false,
  showReset = false,
  onCancel,
  onReset,
  children,
  className,
  align = 'right',
}: FormActionsProps) {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div className={cn('flex items-center gap-3 pt-4', alignClasses[align], className)}>
      {children}

      <div className="flex items-center gap-3">
        {showReset && (
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={isSubmitting || disabled}
          >
            {resetText}
          </Button>
        )}

        {showCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelText}
          </Button>
        )}

        <Button type="submit" disabled={isSubmitting || disabled}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitText}
        </Button>
      </div>
    </div>
  );
}

export interface FormSectionProps {
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Section content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-medium">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export interface FormGridProps {
  /** Number of columns */
  columns?: 1 | 2 | 3 | 4;
  /** Gap size */
  gap?: 'sm' | 'md' | 'lg';
  /** Grid content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

export function FormGrid({
  columns = 2,
  gap = 'md',
  children,
  className,
}: FormGridProps) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div className={cn('grid', columnClasses[columns], gapClasses[gap], className)}>
      {children}
    </div>
  );
}
