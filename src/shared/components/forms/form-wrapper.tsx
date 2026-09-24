'use client';

/**
 * FormWrapper Component
 *
 * A wrapper component that provides react-hook-form context with Zod validation.
 */

import { type ReactNode } from 'react';
import {
  useForm,
  type UseFormReturn,
  type FieldValues,
  type DefaultValues,
  type SubmitHandler,
  type SubmitErrorHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ZodSchema } from 'zod';
import { Form } from '@/shared/components/ui/form';
import { cn } from '@/shared/lib/utils';

export interface FormWrapperProps<TFormValues extends FieldValues> {
  /** Zod validation schema */
  schema: ZodSchema<TFormValues>;
  /** Default form values */
  defaultValues?: DefaultValues<TFormValues>;
  /** Form submit handler */
  onSubmit: SubmitHandler<TFormValues>;
  /** Form error handler */
  onError?: SubmitErrorHandler<TFormValues>;
  /** Render prop for form content */
  children: (form: UseFormReturn<TFormValues>) => ReactNode;
  /** Additional class names for the form */
  className?: string;
  /** Form ID */
  id?: string;
}

export function FormWrapper<TFormValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  onError,
  children,
  className,
  id,
}: FormWrapperProps<TFormValues>) {
  const form = useForm<TFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        id={id}
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className={cn('space-y-6', className)}
      >
        {children(form)}
      </form>
    </Form>
  );
}

export interface ControlledFormProps<TFormValues extends FieldValues> {
  /** Pre-configured form instance */
  form: UseFormReturn<TFormValues>;
  /** Form submit handler */
  onSubmit: SubmitHandler<TFormValues>;
  /** Form error handler */
  onError?: SubmitErrorHandler<TFormValues>;
  /** Form content */
  children: ReactNode;
  /** Additional class names for the form */
  className?: string;
  /** Form ID */
  id?: string;
}

export function ControlledForm<TFormValues extends FieldValues>({
  form,
  onSubmit,
  onError,
  children,
  className,
  id,
}: ControlledFormProps<TFormValues>) {
  return (
    <Form {...form}>
      <form
        id={id}
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className={cn('space-y-6', className)}
      >
        {children}
      </form>
    </Form>
  );
}

/**
 * Hook to create a form with Zod validation
 */
export function useZodForm<TFormValues extends FieldValues>(
  schema: ZodSchema<TFormValues>,
  defaultValues?: DefaultValues<TFormValues>
) {
  return useForm<TFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
}
