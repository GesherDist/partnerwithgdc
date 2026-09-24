'use client';

/**
 * FormRadioGroup Component
 *
 * A radio group component with label, options, and error handling.
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
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { cn } from '@/shared/lib/utils';

export interface RadioOption {
  /** Option value */
  value: string;
  /** Option display label */
  label: string;
  /** Option description */
  description?: string;
  /** Whether the option is disabled */
  disabled?: boolean;
}

export interface FormRadioGroupProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  /** Form control from useForm */
  control: Control<TFieldValues>;
  /** Field name */
  name: TName;
  /** Radio group label */
  label?: string;
  /** Help text */
  description?: string;
  /** Radio options */
  options: RadioOption[];
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Additional class names for the container */
  className?: string;
}

export function FormRadioGroup<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  options,
  disabled = false,
  required = false,
  direction = 'vertical',
  className,
}: FormRadioGroupProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('space-y-3', className)}>
          {label && (
            <FormLabel>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              defaultValue={field.value}
              value={field.value}
              disabled={disabled}
              className={cn(
                direction === 'horizontal' ? 'flex flex-row space-x-4' : 'flex flex-col space-y-2'
              )}
            >
              {options.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`${name}-${option.value}`}
                    disabled={option.disabled}
                  />
                  <label
                    htmlFor={`${name}-${option.value}`}
                    className={cn(
                      'text-sm font-medium leading-none cursor-pointer',
                      option.disabled && 'cursor-not-allowed opacity-70'
                    )}
                  >
                    {option.label}
                    {option.description && (
                      <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
