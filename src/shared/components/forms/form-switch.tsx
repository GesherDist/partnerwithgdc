'use client';

/**
 * FormSwitch Component
 *
 * A toggle switch component with label and error handling.
 * Integrates with react-hook-form.
 */

import { type FieldPath, type FieldValues, type Control } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/shared/components/ui/form';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';

export interface FormSwitchProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  /** Form control from useForm */
  control: Control<TFieldValues>;
  /** Field name */
  name: TName;
  /** Switch label */
  label: string;
  /** Help text */
  description?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional class names for the container */
  className?: string;
}

export function FormSwitch<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  disabled = false,
  className,
}: FormSwitchProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            'flex flex-row items-center justify-between rounded-lg border p-4',
            className
          )}
        >
          <div className="space-y-0.5">
            <FormLabel className="text-base">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export interface FormSwitchInlineProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  /** Form control from useForm */
  control: Control<TFieldValues>;
  /** Field name */
  name: TName;
  /** Switch label */
  label: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

export function FormSwitchInline<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  disabled = false,
  className,
}: FormSwitchInlineProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('flex flex-row items-center space-x-2 space-y-0', className)}>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormLabel className="font-normal cursor-pointer">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}
