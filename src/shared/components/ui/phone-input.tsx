'use client';

/**
 * PhoneInput Component
 *
 * Input with phone number formatting: (555) 123-4567
 * Custom implementation without external dependencies.
 */

import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
}

/**
 * Format phone number as (XXX) XXX-XXXX
 */
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Limit to 10 digits
  const limited = digits.slice(0, 10);

  // Format based on length
  if (limited.length === 0) {
    return '';
  } else if (limited.length <= 3) {
    return `(${limited}`;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  } else {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, onValueChange, value, defaultValue, ...props }, ref) => {
    // Internal state for uncontrolled mode
    const [internalValue, setInternalValue] = React.useState<string>(() => {
      const initial = (value ?? defaultValue ?? '') as string;
      return formatPhoneNumber(initial);
    });

    // Determine if controlled or uncontrolled
    const isControlled = value !== undefined;
    const displayValue = isControlled ? formatPhoneNumber(String(value || '')) : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formatted = formatPhoneNumber(rawValue);

      // Update internal state for uncontrolled mode
      if (!isControlled) {
        setInternalValue(formatted);
      }

      // Create synthetic event with formatted value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange?.(syntheticEvent);

      // Also provide clean digits-only value
      if (onValueChange) {
        const cleanValue = formatted.replace(/\D/g, '');
        onValueChange(cleanValue);
      }
    };

    return (
      <input
        {...props}
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder={props.placeholder || '(555) 123-4567'}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      />
    );
  }
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
