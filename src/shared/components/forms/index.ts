/**
 * Shared Form Components
 *
 * Higher-level form components that integrate with react-hook-form and Zod.
 */

// Form Input
export { FormInput, type FormInputProps } from './form-input';

// Form Textarea
export { FormTextarea, type FormTextareaProps } from './form-textarea';

// Form Select
export {
  FormSelect,
  type FormSelectProps,
  type SelectOption,
} from './form-select';

// Form Checkbox
export {
  FormCheckbox,
  FormCheckboxSimple,
  type FormCheckboxProps,
  type FormCheckboxSimpleProps,
} from './form-checkbox';

// Form Switch
export {
  FormSwitch,
  FormSwitchInline,
  type FormSwitchProps,
  type FormSwitchInlineProps,
} from './form-switch';

// Form Radio Group
export {
  FormRadioGroup,
  type FormRadioGroupProps,
  type RadioOption,
} from './form-radio-group';

// Form Date Picker
export {
  FormDatePicker,
  FormDateRangePicker,
  type FormDatePickerProps,
  type FormDateRangePickerProps,
} from './form-date-picker';

// Form Wrapper & Utilities
export {
  FormWrapper,
  ControlledForm,
  useZodForm,
  type FormWrapperProps,
  type ControlledFormProps,
} from './form-wrapper';

// Form Actions & Layout
export {
  FormActions,
  FormSection,
  FormGrid,
  type FormActionsProps,
  type FormSectionProps,
  type FormGridProps,
} from './form-actions';

// Re-export base form components from shadcn/ui
export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from '@/shared/components/ui/form';
