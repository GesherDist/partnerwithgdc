/**
 * Customer Feature Module
 *
 * Public API for the Customer feature.
 */

// Components (all UI exports)
export * from './components';

// Hooks (all custom hooks)
export * from './hooks';

// Types (all TypeScript interfaces, excluding ActionResult to avoid conflict)
export {
  type CustomerStatus,
  type CustomerChannel,
  type CreditStatus,
  type Customer,
  type CustomerTableRow,
  type CustomerFormValues,
  type CustomerListParams,
  type CreateCustomerDTO,
  type UpdateCustomerDTO,
  type CustomerDropdownItem,
  type CreateCustomerDrawerProps,
  type CustomersTableProps,
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_CHANNELS,
  CUSTOMER_CHANNEL_LABELS,
  CUSTOMER_CHANNEL_COLORS,
  CREDIT_STATUSES,
  CREDIT_STATUS_LABELS,
  CREDIT_STATUS_COLORS,
  DEFAULT_CUSTOMER_FORM_VALUES,
} from './types';

// Actions (all server actions)
export * from './actions';

// Schemas (validation schemas)
export * from './lib/schemas';

// NOTE: Repository and Service are NOT exported here to avoid
// importing server-only code into client components.
// Import them directly where needed:
// import { customerRepository } from '@/features/customers/repositories';
// import { customerService } from '@/features/customers/services';
